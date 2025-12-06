"""
Утилиты для бэкапирования и экспорта данных в SQL
"""
from django.db import connection
from django.contrib.auth.models import User
from .models import Account, Transaction, Goal, BudgetCategory, UserProfile
from datetime import datetime


def generate_sql_backup_all():
    """
    Генерирует полный SQL бэкап всей базы данных с DROP/CREATE инструкциями
    """
    sql_lines = []
    sql_lines.append("-- CtrlMoney Database Backup")
    sql_lines.append(f"-- Generated: {datetime.now().isoformat()}")
    sql_lines.append("-- This backup includes all data from the database")
    sql_lines.append("")
    sql_lines.append("BEGIN TRANSACTION;")
    sql_lines.append("")
    
    # Бэкап пользователей
    sql_lines.append("-- ===== AUTH_USER TABLE =====")
    users = User.objects.all()
    for user in users:
        sql = generate_user_insert_sql(user)
        sql_lines.append(sql)
    
    sql_lines.append("")
    sql_lines.append("-- ===== MAIN_USERPROFILE TABLE =====")
    for user in users:
        try:
            profile = user.profile
            sql = generate_userprofile_insert_sql(profile)
            sql_lines.append(sql)
        except:
            pass
    
    sql_lines.append("")
    sql_lines.append("-- ===== MAIN_ACCOUNT TABLE =====")
    for account in Account.objects.all():
        sql = generate_account_insert_sql(account)
        sql_lines.append(sql)
    
    sql_lines.append("")
    sql_lines.append("-- ===== MAIN_TRANSACTION TABLE =====")
    for transaction in Transaction.objects.all():
        sql = generate_transaction_insert_sql(transaction)
        sql_lines.append(sql)
    
    sql_lines.append("")
    sql_lines.append("-- ===== MAIN_GOAL TABLE =====")
    for goal in Goal.objects.all():
        sql = generate_goal_insert_sql(goal)
        sql_lines.append(sql)
    
    sql_lines.append("")
    sql_lines.append("-- ===== MAIN_BUDGETCATEGORY TABLE =====")
    for budget_cat in BudgetCategory.objects.all():
        sql = generate_budgetcategory_insert_sql(budget_cat)
        sql_lines.append(sql)
    
    sql_lines.append("")
    sql_lines.append("COMMIT;")
    
    return "\n".join(sql_lines)


def generate_sql_backup_by_user(user):
    """
    Генерирует SQL бэкап для конкретного пользователя
    """
    sql_lines = []
    sql_lines.append("-- CtrlMoney Database Backup - User Specific")
    sql_lines.append(f"-- Generated: {datetime.now().isoformat()}")
    sql_lines.append(f"-- User: {user.username}")
    sql_lines.append("")
    sql_lines.append("BEGIN TRANSACTION;")
    sql_lines.append("")
    
    # Бэкап пользователя
    sql_lines.append("-- ===== USER DATA =====")
    sql = generate_user_insert_sql(user)
    sql_lines.append(sql)
    
    # Профиль
    sql_lines.append("")
    sql_lines.append("-- ===== USER PROFILE =====")
    try:
        profile = user.profile
        sql = generate_userprofile_insert_sql(profile)
        sql_lines.append(sql)
    except:
        pass
    
    # Счета
    sql_lines.append("")
    sql_lines.append("-- ===== ACCOUNTS =====")
    for account in user.accounts.all():
        sql = generate_account_insert_sql(account)
        sql_lines.append(sql)
    
    # Транзакции
    sql_lines.append("")
    sql_lines.append("-- ===== TRANSACTIONS =====")
    for transaction in user.transactions.all():
        sql = generate_transaction_insert_sql(transaction)
        sql_lines.append(sql)
    
    # Цели
    sql_lines.append("")
    sql_lines.append("-- ===== GOALS =====")
    for goal in user.goals.all():
        sql = generate_goal_insert_sql(goal)
        sql_lines.append(sql)
    
    # Категории бюджета
    sql_lines.append("")
    sql_lines.append("-- ===== BUDGET CATEGORIES =====")
    for budget_cat in user.budget_categories.all():
        sql = generate_budgetcategory_insert_sql(budget_cat)
        sql_lines.append(sql)
    
    sql_lines.append("")
    sql_lines.append("COMMIT;")
    
    return "\n".join(sql_lines)


def escape_sql_string(value):
    """Экранирует строку для SQL запроса"""
    if value is None:
        return "NULL"
    escaped = str(value).replace("'", "''")
    return f"'{escaped}'"


def generate_user_insert_sql(user):
    """Генерирует INSERT запрос для пользователя"""
    columns = [
        'id', 'password', 'last_login', 'is_superuser', 'username', 
        'first_name', 'last_name', 'email', 'is_staff', 'is_active', 
        'date_joined'
    ]
    values = [
        str(user.id),
        escape_sql_string(user.password),
        'NULL' if user.last_login is None else escape_sql_string(user.last_login.isoformat()),
        '1' if user.is_superuser else '0',
        escape_sql_string(user.username),
        escape_sql_string(user.first_name),
        escape_sql_string(user.last_name),
        escape_sql_string(user.email),
        '1' if user.is_staff else '0',
        '1' if user.is_active else '0',
        escape_sql_string(user.date_joined.isoformat())
    ]
    
    cols_str = ', '.join(columns)
    vals_str = ', '.join(values)
    
    return f"INSERT INTO auth_user ({cols_str}) VALUES ({vals_str});"


def generate_userprofile_insert_sql(profile):
    """Генерирует INSERT запрос для профиля пользователя"""
    columns = ['id', 'user_id', 'first_name', 'last_name', 'patronymic', 'created_at', 'updated_at']
    values = [
        str(profile.id),
        str(profile.user_id),
        escape_sql_string(profile.first_name),
        escape_sql_string(profile.last_name),
        escape_sql_string(profile.patronymic),
        escape_sql_string(profile.created_at.isoformat()),
        escape_sql_string(profile.updated_at.isoformat())
    ]
    
    cols_str = ', '.join(columns)
    vals_str = ', '.join(values)
    
    return f"INSERT INTO main_userprofile ({cols_str}) VALUES ({vals_str});"


def generate_account_insert_sql(account):
    """Генерирует INSERT запрос для счета"""
    columns = [
        'id', 'user_id', 'name', 'amount', 'account_type', 'description',
        'created_at', 'updated_at'
    ]
    values = [
        str(account.id),
        str(account.user_id),
        escape_sql_string(account.name),
        str(account.amount),
        escape_sql_string(account.account_type),
        escape_sql_string(account.description),
        escape_sql_string(account.created_at.isoformat()),
        escape_sql_string(account.updated_at.isoformat())
    ]
    
    cols_str = ', '.join(columns)
    vals_str = ', '.join(values)
    
    return f"INSERT INTO main_account ({cols_str}) VALUES ({vals_str});"


def generate_transaction_insert_sql(transaction):
    """Генерирует INSERT запрос для транзакции"""
    columns = [
        'id', 'user_id', 'name', 'amount', 'transaction_type', 'category',
        'date', 'account_id', 'created_at', 'updated_at'
    ]
    values = [
        str(transaction.id),
        str(transaction.user_id),
        escape_sql_string(transaction.name),
        str(transaction.amount),
        escape_sql_string(transaction.transaction_type),
        escape_sql_string(transaction.category),
        escape_sql_string(transaction.date.isoformat()),
        str(transaction.account_id) if transaction.account_id else 'NULL',
        escape_sql_string(transaction.created_at.isoformat()),
        escape_sql_string(transaction.updated_at.isoformat())
    ]
    
    cols_str = ', '.join(columns)
    vals_str = ', '.join(values)
    
    return f"INSERT INTO main_transaction ({cols_str}) VALUES ({vals_str});"


def generate_goal_insert_sql(goal):
    """Генерирует INSERT запрос для цели"""
    columns = [
        'id', 'user_id', 'name', 'target_amount', 'current_amount',
        'use_only_linked_accounts', 'created_at', 'updated_at'
    ]
    values = [
        str(goal.id),
        str(goal.user_id),
        escape_sql_string(goal.name),
        str(goal.target_amount),
        str(goal.current_amount),
        '1' if goal.use_only_linked_accounts else '0',
        escape_sql_string(goal.created_at.isoformat()),
        escape_sql_string(goal.updated_at.isoformat())
    ]
    
    cols_str = ', '.join(columns)
    vals_str = ', '.join(values)
    
    return f"INSERT INTO main_goal ({cols_str}) VALUES ({vals_str});"


def generate_budgetcategory_insert_sql(budget_cat):
    """Генерирует INSERT запрос для категории бюджета"""
    columns = [
        'id', 'user_id', 'name', 'budget', 'emoji', 'created_at', 'updated_at'
    ]
    values = [
        str(budget_cat.id),
        str(budget_cat.user_id),
        escape_sql_string(budget_cat.name),
        str(budget_cat.budget),
        escape_sql_string(budget_cat.emoji),
        escape_sql_string(budget_cat.created_at.isoformat()),
        escape_sql_string(budget_cat.updated_at.isoformat())
    ]
    
    cols_str = ', '.join(columns)
    vals_str = ', '.join(values)
    
    return f"INSERT INTO main_budgetcategory ({cols_str}) VALUES ({vals_str});"
