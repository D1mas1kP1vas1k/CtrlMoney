from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from main.models import Account, Transaction, Goal, BudgetCategory
import json
from django.contrib.admin.views.decorators import staff_member_required
from django.db import connection
from django.shortcuts import redirect



# Главная страница прогноза
@ensure_csrf_cookie
@login_required(login_url='main:login')
def index(request):
	"""Render forecast index page. Предоставляет данные через context"""
	
	# Получаем данные пользователя
	accounts = Account.objects.filter(user=request.user).values('id', 'name', 'amount', 'account_type')
	transactions = Transaction.objects.filter(user=request.user).values('id', 'name', 'amount', 'transaction_type', 'category', 'date')
	goals = Goal.objects.filter(user=request.user).values('id', 'name', 'target_amount', 'current_amount')
	budget_categories = BudgetCategory.objects.filter(user=request.user).values('id', 'name', 'budget', 'emoji')
	
	# Преобразуем decimal значения для JSON
	accounts_list = []
	for acc in accounts:
		accounts_list.append({
			'id': acc['id'],
			'name': acc['name'],
			'amount': float(acc['amount']),
			'account_type': acc['account_type'],
		})
	
	transactions_list = []
	for tx in transactions:
		transactions_list.append({
			'id': tx['id'],
			'name': tx['name'],
			'amount': float(tx['amount']),
			'transaction_type': tx['transaction_type'],
			'category': tx['category'],
			'date': tx['date'].strftime('%Y-%m-%d') if tx['date'] else '',
		})
	
	goals_list = []
	for g in goals:
		goals_list.append({
			'id': g['id'],
			'name': g['name'],
			'target_amount': float(g['target_amount']),
			'current_amount': float(g['current_amount']),
		})
	
	categories_list = []
	for bc in budget_categories:
		categories_list.append({
			'id': bc['id'],
			'name': bc['name'],
			'budget': float(bc['budget']),
			'emoji': bc['emoji'],
		})

	
	
	context = {
		'accounts_json': json.dumps(accounts_list),
		'transactions_json': json.dumps(transactions_list),
		'goals_json': json.dumps(goals_list),
		'categories_json': json.dumps(categories_list),
	}
	
	return render(request, 'forecast/index.html', context)


# API: Счета пользователя (для фронтенда при необходимости)
@login_required
def api_accounts(request):
	accounts = Account.objects.filter(user=request.user)
	data = [
		{
			'id': acc.id,
			'name': acc.name,
			'amount': float(acc.amount),
			'account_type': acc.account_type,
		}
		for acc in accounts
	]
	return JsonResponse({'success': True, 'accounts': data})


# API: Транзакции пользователя
@login_required
def api_transactions(request):
	txs = Transaction.objects.filter(user=request.user)
	data = [
		{
			'id': tx.id,
			'name': tx.name,
			'amount': float(tx.amount),
			'transaction_type': tx.transaction_type,
			'category': tx.category,
			'date': tx.date.strftime('%Y-%m-%d'),
			'account': tx.account.name if tx.account else None,
		}
		for tx in txs
	]
	return JsonResponse({'success': True, 'transactions': data})


# API: Финансовые цели пользователя
@login_required
def api_goals(request):
    goals = Goal.objects.filter(user=request.user).prefetch_related('linked_accounts')
    data = []
    for g in goals:
        data.append({
            'id': g.id,
            'name': g.name,
            'target': float(g.target_amount),
            'target_amount': float(g.target_amount),
            'current_amount': float(g.current_amount),  # оставляем для совместимости
            'use_only_accounts': g.use_only_linked_accounts,
            'accounts': [acc.id for acc in g.linked_accounts.all()],
        })
    return JsonResponse({'success': True, 'goals': data})


# API: Категории бюджета пользователя
@login_required
def api_budget_categories(request):
	"""GET: Получить все категории бюджета пользователя"""
	if request.method == 'GET':
		categories = BudgetCategory.objects.filter(user=request.user)
		data = [
			{
				'id': c.id,
				'name': c.name,
				'budget': float(c.budget),
				'emoji': c.emoji,
			}
			for c in categories
		]
		return JsonResponse({'success': True, 'categories': data})
	
	return JsonResponse({'success': False, 'error': 'Invalid request method'})


# API: Сохранить или обновить категорию
@login_required
def api_save_category(request):
	"""POST: Сохранить новую или обновить существующую категорию"""
	if request.method == 'POST':
		try:
			data = json.loads(request.body)
			name = data.get('name', '').strip()
			budget = float(data.get('budget', 0))
			emoji = data.get('emoji', '')
			
			if not name:
				return JsonResponse({'success': False, 'error': 'Название категории обязательно'})
			
			# Использую get_or_create для обновления существующей или создания новой
			category, created = BudgetCategory.objects.get_or_create(
				user=request.user,
				name=name,
				defaults={'budget': budget, 'emoji': emoji}
			)
			
			if not created:
				category.budget = budget
				category.emoji = emoji
				category.save()
			
			return JsonResponse({
				'success': True,
				'category': {
					'id': category.id,
					'name': category.name,
					'budget': float(category.budget),
					'emoji': category.emoji,
				}
			})
		except Exception as e:
			return JsonResponse({'success': False, 'error': str(e)})
	
	return JsonResponse({'success': False, 'error': 'Invalid request method'})


# API: Удалить категорию
@login_required
def api_delete_category(request):
	"""POST: Удалить категорию"""
	if request.method == 'POST':
		try:
			data = json.loads(request.body)
			category_id = data.get('id')
			
			category = BudgetCategory.objects.get(id=category_id, user=request.user)
			category.delete()
			
			return JsonResponse({'success': True, 'message': 'Категория удалена'})
		except BudgetCategory.DoesNotExist:
			return JsonResponse({'success': False, 'error': 'Категория не найдена'})
		except Exception as e:
			return JsonResponse({'success': False, 'error': str(e)})
	
	return JsonResponse({'success': False, 'error': 'Invalid request method'})


# === НОВЫЕ API ДЛЯ ЦЕЛЕЙ С ПРИВЯЗКОЙ СЧЕТОВ ===

@login_required
@csrf_exempt
def api_save_goal_forecast(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            goal_id = data.get('id')

            if goal_id:
                goal = Goal.objects.get(id=goal_id, user=request.user)
            else:
                goal = Goal(user=request.user)

            goal.name = data['name']
            goal.target_amount = data['target_amount']
            goal.use_only_linked_accounts = data.get('use_only_accounts', False)
            goal.save()

            # Обновляем привязанные счета
            goal.linked_accounts.clear()
            for acc_id in data.get('accounts', []):
                goal.linked_accounts.add(Account.objects.get(id=acc_id))

            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'POST only'})


@login_required
@csrf_exempt
def api_delete_goal_forecast(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            goal = Goal.objects.get(id=data['id'], user=request.user)
            goal.delete()
            return JsonResponse({'success': True})
        except Goal.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Цель не найдена'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False})

@staff_member_required(login_url='main:login')
def sql_panel_view(request):
    results = None
    columns = None
    error = None
    query = ""

    if request.method == "POST":
        query = request.POST.get("sql", "").strip()

        # Жёсткая защита
        lower_query = query.lower()
        if not lower_query.startswith("select"):
            error = "Разрешены ТОЛЬКО SELECT-запросы!"
        elif any(danger in lower_query for danger in ["delete", "update", "insert", "drop", "alter", "create", "truncate", "grant", "exec", "xp_", "--", "/*"]):
            error = "Опасная команда обнаружена! Запрещено."
        else:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query)
                    columns = [col[0] for col in cursor.description]
                    results = cursor.fetchall()
            except Exception as e:
                error = f"Ошибка в запросе: {e}"

    return render(request, "main/sql_panel.html", {
        "query": query,
        "results": results,
        "columns": columns,
        "error": error,
    })
