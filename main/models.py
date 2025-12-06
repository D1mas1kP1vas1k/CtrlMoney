from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.db.models.signals import post_save
from django.dispatch import receiver
from decimal import Decimal


class Account(models.Model):
    """Модель счёта"""
    ACCOUNT_TYPES = [
        ('deposit', 'Вклад'),
        ('debit', 'Дебетовый счет'),
        ('credit', 'Кредитный счет'),
        ('savings', 'Накопительный счет'),
        ('investment', 'Инвестиционный счет'),
        ('cash', 'Наличные'),
        ('other', 'Другое'),
    ]
    
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='accounts',
        verbose_name='Пользователь',
        db_index=True
    )
    name = models.CharField(max_length=100, verbose_name='Название')
    amount = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name='Сумма'
    ) 
    account_type = models.CharField(
        max_length=20, 
        choices=ACCOUNT_TYPES, 
        default='other',
        verbose_name='Тип счета',
        db_index=True
    )
    description = models.TextField(blank=True, default='', verbose_name='Описание')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания', db_index=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Счет'
        verbose_name_plural = 'Счета'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f'{self.name} ({self.get_amount_display()}₽)'
    
    def get_amount_display(self):
        return f"{self.amount:,.0f}".replace(',', ' ')


class Transaction(models.Model):
    """Модель транзакции"""
    TRANSACTION_TYPES = [
        ('income', 'Доход'),
        ('expense', 'Расход'),
    ]
    
    CATEGORIES = [
        ('еда', 'Еда'),
        ('транспорт', 'Транспорт'),
        ('развлечения', 'Развлечения'),
        ('жилье', 'Жилье'),
        ('здоровье', 'Здоровье'),
        ('одежда', 'Одежда'),
        ('доход', 'Доход'),
        ('другое', 'Другое'),
    ]
    
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='transactions',
        verbose_name='Пользователь',
        db_index=True
    )
    name = models.CharField(max_length=200, verbose_name='Название')
    amount = models.DecimalField(
        max_digits=15, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Сумма'
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPES,
        verbose_name='Тип',
        db_index=True
    )
    category = models.CharField(
        max_length=50,
        choices=CATEGORIES,
        default='другое',
        verbose_name='Категория',
        db_index=True
    )
    date = models.DateTimeField(verbose_name='Дата', db_index=True)
    account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions',
        verbose_name='Счет'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Транзакция'
        verbose_name_plural = 'Транзакции'
        ordering = ['-date']
        indexes = [
            models.Index(fields=['user', '-date']),
            models.Index(fields=['user', 'transaction_type', '-date']),
        ]
    
    def __str__(self):
        return f'{self.name} - {self.amount}₽ ({self.date.strftime("%d.%m.%Y")})'


class Goal(models.Model):
    """Модель финансовой цели — РАСШИРЕННАЯ ВЕРСИЯ"""
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='goals',
        verbose_name='Пользователь',
        db_index=True
    )
    name = models.CharField(max_length=200, verbose_name='Название цели')
    target_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Целевая сумма'
    )
    current_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name='Текущая сумма (заполняется вручную, если нужно)'
    )
    use_only_linked_accounts = models.BooleanField(
        "Учитывать только подключённые счета",
        default=False,
        help_text="Если включено — прогресс считается только по подключённым счетам"
    )
    linked_accounts = models.ManyToManyField(
        'Account',
        blank=True,
        related_name='linked_goals',
        verbose_name='Подключённые счета'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Финансовая цель'
        verbose_name_plural = 'Финансовые цели'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} → {self.target_amount}₽'

    @property
    def progress_percent(self):
        total = self.calculated_amount
        if not total or self.target_amount == 0:
            return 0
        return min(int((total / self.target_amount) * 100), 100)

    @property
    def calculated_amount(self):
        """Автоматический расчёт накопленного — ТОЧНО как в твоём forecast!"""
        from decimal import Decimal
        
        # Общие свободные средства (доходы − расходы)
        free_money = Decimal('0')
        user_transactions = self.user.transactions.all()
        income = sum(t.amount for t in user_transactions if t.transaction_type == 'income')
        expense = sum(t.amount for t in user_transactions if t.transaction_type == 'expense')
        free_money = income - expense

        # Сумма по подключённым счетам
        linked_sum = sum(acc.amount for acc in self.linked_accounts.all())

        if self.use_only_linked_accounts:
            return linked_sum
        else:
            return free_money + linked_sum


class BudgetCategory(models.Model):
    """Модель бюджета по категориям - для сохранения бюджетных пределов пользователя"""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='budget_categories',
        verbose_name='Пользователь',
        db_index=True
    )
    name = models.CharField(max_length=50, verbose_name='Название категории')
    budget = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name='Бюджет на месяц'
    )
    emoji = models.CharField(max_length=10, blank=True, verbose_name='Эмодзи')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания', db_index=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Бюджет по категории'
        verbose_name_plural = 'Бюджеты по категориям'
        ordering = ['name']
        indexes = [
            models.Index(fields=['user', 'name']),
        ]
        unique_together = [['user', 'name']]
    
    def __str__(self):
        return f'{self.name} - {self.budget}₽ ({self.user.username})'


class UserProfile(models.Model):
    """Профиль пользователя с ФИО"""
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile',
        verbose_name='Пользователь'
    )
    first_name = models.CharField(max_length=100, verbose_name='Имя')
    last_name = models.CharField(max_length=100, verbose_name='Фамилия')
    patronymic = models.CharField(max_length=100, blank=True, verbose_name='Отчество')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        verbose_name = 'Профиль пользователя'
        verbose_name_plural = 'Профили пользователей'
    
    def __str__(self):
        fio = f'{self.last_name} {self.first_name}'
        if self.patronymic:
            fio += f' {self.patronymic}'
        return fio
    
    @property
    def full_name(self):
        """Получить полное имя пользователя"""
        fio = f'{self.last_name} {self.first_name}'
        if self.patronymic:
            fio += f' {self.patronymic}'
        return fio


# Сигнал для автоматического создания профиля пользователя
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Создавать профиль автоматически при регистрации"""
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Сохранять профиль автоматически"""
    # Проверяем что профиль существует перед сохранением
    if hasattr(instance, 'profile'):
        instance.profile.save()
    else:
        # Если профиля нет (старый пользователь), создаем его
        if not UserProfile.objects.filter(user=instance).exists():
            UserProfile.objects.create(user=instance)