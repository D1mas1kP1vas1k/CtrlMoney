# Generated migration for BudgetCategory model

import django.core.validators
import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0002_account_user_goal_user_transaction_user'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='account',
            name='description',
            field=models.TextField(blank=True, default='', verbose_name='Описание'),
        ),
        migrations.CreateModel(
            name='BudgetCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, verbose_name='Название категории')),
                ('budget', models.DecimalField(decimal_places=2, default=0, max_digits=15, validators=[django.core.validators.MinValueValidator(Decimal('0.00'))], verbose_name='Бюджет на месяц')),
                ('emoji', models.CharField(blank=True, max_length=10, verbose_name='Эмодзи')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Дата создания')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Дата обновления')),
                ('user', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='budget_categories', to=settings.AUTH_USER_MODEL, verbose_name='Пользователь')),
            ],
            options={
                'verbose_name': 'Бюджет по категории',
                'verbose_name_plural': 'Бюджеты по категориям',
                'ordering': ['name'],
                'unique_together': {('user', 'name')},
            },
        ),
        migrations.AddIndex(
            model_name='budgetcategory',
            index=models.Index(fields=['user', 'name'], name='main_budget_user_id_name_idx'),
        ),
    ]
