"""
Утилиты для импорта/экспорта данных из JSON
"""
import json
from decimal import Decimal, InvalidOperation
from django.utils import timezone
from django.contrib.auth.models import User
from datetime import datetime
from .models import Account, Transaction, Goal, BudgetCategory


def import_user_data_from_json(json_content, user):
    """
    Импортирует данные пользователя из JSON
    
    Ожидаемая структура JSON:
    {
        "accounts": [
            {"name": "...", "amount": 1000, "account_type": "debit", "description": "..."},
            ...
        ],
        "transactions": [
            {"name": "...", "amount": 100, "transaction_type": "expense", "category": "еда", "date": "2023-01-01T10:00:00", "account_id": 1},
            ...
        ],
        "goals": [
            {"name": "...", "target_amount": 50000, "current_amount": 10000},
            ...
        ],
        "budget_categories": [
            {"name": "еда", "budget": 5000, "emoji": "🍔"},
            ...
        ]
    }
    """
    results = {
        'accounts': {'created': 0, 'errors': []},
        'transactions': {'created': 0, 'errors': []},
        'goals': {'created': 0, 'errors': []},
        'budget_categories': {'created': 0, 'errors': []},
    }
    
    try:
        data = json.loads(json_content)
    except json.JSONDecodeError as e:
        return {
            'success': False,
            'error': f'Ошибка парсинга JSON: {str(e)}',
            'results': results
        }
    
    # Импорт счетов
    if 'accounts' in data and isinstance(data['accounts'], list):
        for idx, account_data in enumerate(data['accounts']):
            try:
                amount = Decimal(str(account_data.get('amount', 0)))
                
                account = Account.objects.create(
                    user=user,
                    name=account_data.get('name', f'Счет {idx+1}'),
                    amount=amount,
                    account_type=account_data.get('account_type', 'other'),
                    description=account_data.get('description', '')
                )
                results['accounts']['created'] += 1
            except Exception as e:
                results['accounts']['errors'].append(
                    f"Строка {idx+1}: {str(e)}"
                )
    
    # Импорт транзакций
    if 'transactions' in data and isinstance(data['transactions'], list):
        accounts_map = {acc.id: acc for acc in user.accounts.all()}
        
        for idx, tx_data in enumerate(data['transactions']):
            try:
                amount = Decimal(str(tx_data.get('amount', 0)))
                if amount <= 0:
                    raise ValueError("Сумма должна быть больше нуля")
                
                # Парсинг даты
                date_str = tx_data.get('date')
                if date_str:
                    try:
                        tx_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                        if timezone.is_naive(tx_date):
                            tx_date = timezone.make_aware(tx_date, timezone.get_default_timezone())
                    except:
                        tx_date = timezone.now()
                else:
                    tx_date = timezone.now()
                
                # Привязка счета
                account = None
                account_id = tx_data.get('account_id')
                if account_id and account_id in accounts_map:
                    account = accounts_map[account_id]
                
                transaction = Transaction.objects.create(
                    user=user,
                    name=tx_data.get('name', f'Транзакция {idx+1}'),
                    amount=amount,
                    transaction_type=tx_data.get('transaction_type', 'expense'),
                    category=tx_data.get('category', 'другое'),
                    date=tx_date,
                    account=account
                )
                results['transactions']['created'] += 1
            except Exception as e:
                results['transactions']['errors'].append(
                    f"Строка {idx+1}: {str(e)}"
                )
    
    # Импорт целей
    if 'goals' in data and isinstance(data['goals'], list):
        for idx, goal_data in enumerate(data['goals']):
            try:
                target_amount = Decimal(str(goal_data.get('target_amount', 0)))
                if target_amount <= 0:
                    raise ValueError("Целевая сумма должна быть больше нуля")
                
                current_amount = Decimal(str(goal_data.get('current_amount', 0)))
                if current_amount < 0:
                    raise ValueError("Текущая сумма не может быть отрицательной")
                
                goal = Goal.objects.create(
                    user=user,
                    name=goal_data.get('name', f'Цель {idx+1}'),
                    target_amount=target_amount,
                    current_amount=current_amount
                )
                results['goals']['created'] += 1
            except Exception as e:
                results['goals']['errors'].append(
                    f"Строка {idx+1}: {str(e)}"
                )
    
    # Импорт категорий бюджета
    if 'budget_categories' in data and isinstance(data['budget_categories'], list):
        for idx, bc_data in enumerate(data['budget_categories']):
            try:
                budget = Decimal(str(bc_data.get('budget', 0)))
                
                # Проверяем уникальность
                if BudgetCategory.objects.filter(user=user, name=bc_data.get('name')).exists():
                    raise ValueError("Категория с таким названием уже существует")
                
                budget_cat = BudgetCategory.objects.create(
                    user=user,
                    name=bc_data.get('name', f'Категория {idx+1}'),
                    budget=budget,
                    emoji=bc_data.get('emoji', '')
                )
                results['budget_categories']['created'] += 1
            except Exception as e:
                results['budget_categories']['errors'].append(
                    f"Строка {idx+1}: {str(e)}"
                )
    
    return {
        'success': True,
        'results': results
    }


def validate_json_structure(json_content):
    """
    Валидирует структуру JSON файла перед импортом
    """
    try:
        data = json.loads(json_content)
    except json.JSONDecodeError as e:
        return False, f'Ошибка парсинга JSON: {str(e)}'
    
    if not isinstance(data, dict):
        return False, 'JSON должен быть объектом'
    
    allowed_keys = {'accounts', 'transactions', 'goals', 'budget_categories'}
    provided_keys = set(data.keys())
    
    unknown_keys = provided_keys - allowed_keys
    if unknown_keys:
        return False, f'Неизвестные ключи: {", ".join(unknown_keys)}'
    
    # Валидация структуры внутри
    errors = []
    
    if 'accounts' in data and not isinstance(data['accounts'], list):
        errors.append('"accounts" должен быть массивом')
    
    if 'transactions' in data and not isinstance(data['transactions'], list):
        errors.append('"transactions" должен быть массивом')
    
    if 'goals' in data and not isinstance(data['goals'], list):
        errors.append('"goals" должен быть массивом')
    
    if 'budget_categories' in data and not isinstance(data['budget_categories'], list):
        errors.append('"budget_categories" должен быть массивом')
    
    if errors:
        return False, '; '.join(errors)
    
    return True, 'Структура JSON корректна'


def export_user_data_to_json(user):
    """
    Экспортирует данные пользователя в JSON формат
    """
    data = {
        'user': user.username,
        'exported_at': timezone.now().isoformat(),
        'accounts': [],
        'transactions': [],
        'goals': [],
        'budget_categories': []
    }
    
    # Экспорт счетов
    for account in user.accounts.all():
        data['accounts'].append({
            'id': account.id,
            'name': account.name,
            'amount': str(account.amount),
            'account_type': account.account_type,
            'description': account.description,
            'created_at': account.created_at.isoformat(),
        })
    
    # Экспорт транзакций
    for transaction in user.transactions.all():
        data['transactions'].append({
            'id': transaction.id,
            'name': transaction.name,
            'amount': str(transaction.amount),
            'transaction_type': transaction.transaction_type,
            'category': transaction.category,
            'date': transaction.date.isoformat(),
            'account_id': transaction.account_id,
            'created_at': transaction.created_at.isoformat(),
        })
    
    # Экспорт целей
    for goal in user.goals.all():
        data['goals'].append({
            'id': goal.id,
            'name': goal.name,
            'target_amount': str(goal.target_amount),
            'current_amount': str(goal.current_amount),
            'created_at': goal.created_at.isoformat(),
        })
    
    # Экспорт категорий бюджета
    for budget_cat in user.budget_categories.all():
        data['budget_categories'].append({
            'id': budget_cat.id,
            'name': budget_cat.name,
            'budget': str(budget_cat.budget),
            'emoji': budget_cat.emoji,
            'created_at': budget_cat.created_at.isoformat(),
        })
    
    return json.dumps(data, ensure_ascii=False, indent=2)
