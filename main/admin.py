from django.contrib import admin
from django.utils.html import format_html
from django.urls import path
from django.shortcuts import render
from django.contrib.auth.decorators import user_passes_test
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_http_methods
from django import forms
from django.db import connection
import json
import requests
from .models import Account, Transaction, Goal, BudgetCategory, UserProfile
from .backup_utils import generate_sql_backup_all, generate_sql_backup_by_user


# === SQL PANEL ===

class SQLCommandForm(forms.Form):
    """Форма для ввода SQL команд"""
    query = forms.CharField(
        widget=forms.Textarea(attrs={
            'rows': 10,
            'cols': 80,
            'placeholder': 'Введите SQL запрос...',
            'style': 'font-family: monospace; width: 100%;'
        }),
        label='SQL Запрос'
    )


def is_superuser(user):
    """Проверка что пользователь суперюзер"""
    return user.is_superuser


class CustomAdminSite(admin.AdminSite):
    """Кастомный админ-сайт с SQL панелью"""
    site_header = "CtrlMoney Администрирование"
    site_title = "Админ-панель CtrlMoney"
    index_title = "Добро пожаловать в админ-панель"
    
    def get_urls(self):
        """Добавляем URL для SQL панели"""
        urls = super().get_urls()
        custom_urls = [
            path('sql-panel/', self.admin_view(sql_panel_view), name='sql_panel'),
            path('emulator-check/', self.admin_view(emulator_check_view), name='emulator_check'),
            path('emulator-check/ajax/', self.admin_view(emulator_check_ajax), name='emulator_check_ajax'),
            path('backup/', self.admin_view(backup_view), name='backup'),
            path('backup/full/', self.admin_view(backup_full), name='backup_full'),
            path('backup/user/<int:user_id>/', self.admin_view(backup_user), name='backup_user'),
        ]
        return custom_urls + urls
    
    def index(self, request, extra_context=None):
        """Главная страница админа с SQL консолью"""
        extra_context = extra_context or {}
        
        # Добавляем статистику
        from django.contrib.auth.models import User
        extra_context['stats'] = {
            'users_count': User.objects.count(),
            'accounts_count': Account.objects.count(),
            'transactions_count': Transaction.objects.count(),
            'goals_count': Goal.objects.count(),
        }
        
        # Добавляем ссылку на бэкапы
        extra_context['backup_url'] = '/admin/backup/'
        
        # Обработка SQL формы
        form = SQLCommandForm()
        results = None
        error = None
        
        if request.method == 'POST':
            form = SQLCommandForm(request.POST)
            if form.is_valid():
                query = form.cleaned_data['query'].strip()
                
                if not query:
                    error = 'Пожалуйста, введите SQL запрос'
                else:
                    try:
                        results = execute_sql_query(query)
                    except Exception as e:
                        error = f'Ошибка выполнения запроса: {str(e)}'
        
        extra_context['form'] = form
        extra_context['results'] = results
        extra_context['error'] = error
        
        return super().index(request, extra_context)


def execute_sql_query(query):
    """Выполняет SQL запрос и возвращает результаты"""
    with connection.cursor() as cursor:
        cursor.execute(query)
        
        # Если это SELECT запрос
        if cursor.description:
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
            
            results = {
                'type': 'select',
                'columns': columns,
                'rows': rows,
                'row_count': len(rows)
            }
        else:
            # Для INSERT, UPDATE, DELETE
            results = {
                'type': 'modify',
                'message': f'Запрос выполнен успешно. Затронуто строк: {cursor.rowcount}',
                'row_count': cursor.rowcount
            }
        
        return results


def sql_panel_view(request):
    """Представление для SQL панели"""
    # Проверяем что пользователь суперюзер
    if not request.user.is_superuser:
        from django.contrib.auth.views import redirect_to_login
        return redirect_to_login(request.path, '/admin/login/')
    
    form = SQLCommandForm()
    results = None
    error = None
    query_executed = None
    
    if request.method == 'POST':
        form = SQLCommandForm(request.POST)
        if form.is_valid():
            query = form.cleaned_data['query'].strip()
            query_executed = query
            
            if not query:
                error = 'Пожалуйста, введите SQL запрос'
            else:
                try:
                    results = execute_sql_query(query)
                except Exception as e:
                    error = f'Ошибка выполнения запроса: {str(e)}'
    
    context = {
        'form': form,
        'results': results,
        'error': error,
        'query_executed': query_executed,
        'title': 'SQL Панель Администратора',
        'site_header': 'CtrlMoney Администрирование',
    }
    
    return render(request, 'admin/sql_panel.html', context)


def emulator_check_view(request):
    """Страница администратора для проверки данных эмулятора"""
    # Только суперюзерам
    if not request.user.is_superuser:
        from django.contrib.auth.views import redirect_to_login
        return redirect_to_login(request.path, '/admin/login/')

    return render(request, 'admin/emulator_check.html', {})


@require_http_methods(["POST"])
def emulator_check_ajax(request):
    """AJAX-обработчик: получает сырые данные из эмулятора и валидирует их строго"""
    if not request.user.is_superuser:
        return JsonResponse({'error': 'Доступ запрещён'}, status=403)

    api_url = "http://prb.sylas.ru/TransferSimulator/fullName"
    raw_fio = None
    try:
        resp = requests.get(api_url, timeout=10)
        data = resp.json() if resp.status_code == 200 else {}
        raw_fio = data.get('value') if isinstance(data, dict) else None
    except Exception as e:
        return JsonResponse({'error': 'Ошибка при вызове эмулятора', 'detail': str(e)}, status=502)

    if raw_fio is None:
        return JsonResponse({'error': 'Эмулятор вернул пустые данные'}, status=204)

    # Строгая валидация "как есть"
    from .captcha_utils import strict_validate_raw_fio
    is_valid, reasons = strict_validate_raw_fio(raw_fio)

    report = {
        'raw_fio': raw_fio,
        'is_valid': is_valid,
        'reasons': reasons,
        'note': 'Данные проверены без какой-либо предварительной обработки'
    }

    return JsonResponse(report)


def backup_view(request):
    """Страница администратора для управления бэкапами"""
    if not request.user.is_superuser:
        from django.contrib.auth.views import redirect_to_login
        return redirect_to_login(request.path, '/admin/login/')
    
    from django.contrib.auth.models import User
    users = User.objects.all()
    
    context = {
        'title': 'Управление бэкапами',
        'users': users,
        'site_header': 'CtrlMoney Администрирование',
    }
    
    return render(request, 'admin/backup.html', context)


def backup_full(request):
    """Скачивает полный SQL бэкап всей базы данных"""
    if not request.user.is_superuser:
        return JsonResponse({'error': 'Доступ запрещён'}, status=403)
    
    try:
        sql_backup = generate_sql_backup_all()
        
        response = HttpResponse(sql_backup, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="ctrlmoney_backup_full_{__import__("datetime").datetime.now().strftime("%Y%m%d_%H%M%S")}.sql"'
        
        return response
    except Exception as e:
        return JsonResponse({'error': f'Ошибка генерации бэкапа: {str(e)}'}, status=500)


def backup_user(request, user_id):
    """Скачивает SQL бэкап для конкретного пользователя"""
    if not request.user.is_superuser:
        return JsonResponse({'error': 'Доступ запрещён'}, status=403)
    
    try:
        from django.contrib.auth.models import User
        user = User.objects.get(id=user_id)
        
        sql_backup = generate_sql_backup_by_user(user)
        
        response = HttpResponse(sql_backup, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="ctrlmoney_backup_{user.username}_{__import__("datetime").datetime.now().strftime("%Y%m%d_%H%M%S")}.sql"'
        
        return response
    except Exception as e:
        return JsonResponse({'error': f'Ошибка генерации бэкапа: {str(e)}'}, status=500)


# Используем кастомный админ сайт
admin.site.__class__ = CustomAdminSite


# === МОДЕЛИ АДМИНА ===

class ReadOnlyAdminMixin:
    """Миксин для отключения удаления и массовых операций"""
    
    def has_delete_permission(self, request, obj=None):
        """Отключить удаление"""
        return False
    
    def get_actions(self, request):
        """Убрать массовые операции"""
        actions = super().get_actions(request)
        if 'delete_selected' in actions:
            del actions['delete_selected']
        return actions


@admin.register(Account)
class AccountAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'get_amount_display', 'get_account_type_display', 'get_user_display', 'created_at')
    list_filter = ('account_type', 'created_at', 'user')
    search_fields = ('name', 'description', 'user__username')
    readonly_fields = ('created_at', 'updated_at', 'user')
    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'name', 'amount', 'account_type', 'description')
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_amount_display(self, obj):
        return f"{obj.get_amount_display()}₽"
    get_amount_display.short_description = 'Сумма'
    
    def get_account_type_display(self, obj):
        return obj.get_account_type_display()
    get_account_type_display.short_description = 'Тип счета'
    
    def get_user_display(self, obj):
        return obj.user.username
    get_user_display.short_description = 'Пользователь'


@admin.register(Transaction)
class TransactionAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'amount', 'get_transaction_type_display', 'category', 'date', 'get_user_display', 'account')
    list_filter = ('transaction_type', 'category', 'date', 'created_at', 'user')
    search_fields = ('name', 'category', 'user__username')
    readonly_fields = ('created_at', 'updated_at', 'user')
    date_hierarchy = 'date'
    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'name', 'amount', 'transaction_type', 'category', 'date', 'account')
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_transaction_type_display(self, obj):
        return obj.get_transaction_type_display()
    get_transaction_type_display.short_description = 'Тип'
    
    def get_user_display(self, obj):
        return obj.user.username
    get_user_display.short_description = 'Пользователь'


@admin.register(Goal)
class GoalAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'get_current_display', 'get_target_display', 'get_progress_display', 'get_user_display', 'created_at')
    list_filter = ('created_at', 'user')
    search_fields = ('name', 'user__username')
    readonly_fields = ('created_at', 'updated_at', 'progress_percent', 'user', 'calculated_amount')
    filter_horizontal = ('linked_accounts',)
    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'name', 'target_amount', 'current_amount', 'progress_percent', 'calculated_amount')
        }),
        ('Подключённые счета', {
            'fields': ('use_only_linked_accounts', 'linked_accounts'),
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_current_display(self, obj):
        return f"{obj.current_amount:,.0f}₽"
    get_current_display.short_description = 'Текущая сумма'
    
    def get_target_display(self, obj):
        return f"{obj.target_amount:,.0f}₽"
    get_target_display.short_description = 'Целевая сумма'
    
    def get_progress_display(self, obj):
        percent = obj.progress_percent
        color = 'green' if percent >= 100 else 'orange' if percent >= 50 else 'red'
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}%</span>',
            color,
            percent
        )
    get_progress_display.short_description = 'Прогресс'
    
    def get_user_display(self, obj):
        return obj.user.username
    get_user_display.short_description = 'Пользователь'


@admin.register(BudgetCategory)
class BudgetCategoryAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ('get_emoji_display', 'name', 'get_budget_display', 'get_user_display', 'created_at')
    list_filter = ('created_at', 'user')
    search_fields = ('name', 'user__username')
    readonly_fields = ('created_at', 'updated_at', 'user')
    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'name', 'budget', 'emoji')
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_emoji_display(self, obj):
        return obj.emoji or '📌'
    get_emoji_display.short_description = 'Эмодзи'
    
    def get_budget_display(self, obj):
        return f"{obj.budget:,.0f}₽"
    get_budget_display.short_description = 'Бюджет'
    
    def get_user_display(self, obj):
        return obj.user.username
    get_user_display.short_description = 'Пользователь'


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('get_full_name_display', 'get_user_display', 'created_at')
    list_filter = ('created_at', 'user')
    search_fields = ('first_name', 'last_name', 'patronymic', 'user__username')
    readonly_fields = ('created_at', 'updated_at', 'user')
    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'first_name', 'last_name', 'patronymic')
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_full_name_display(self, obj):
        return obj.full_name
    get_full_name_display.short_description = 'ФИО'
    
    def get_user_display(self, obj):
        return obj.user.username
    get_user_display.short_description = 'Пользователь'
    
    def has_add_permission(self, request):
        """Профили создаются автоматически при регистрации"""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Нельзя удалять профили отдельно"""
        return False


