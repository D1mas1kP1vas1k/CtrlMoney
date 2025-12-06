"""Initial migration for forecast app: create Forecast model."""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('main', '0003_budgetcategory_alter_account_description'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Forecast',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True, verbose_name='Дата прогноза')),
                ('predicted_amount', models.DecimalField(decimal_places=2, max_digits=15, verbose_name='Прогнозируемая сумма')),
                ('notes', models.TextField(blank=True, default='', verbose_name='Примечание')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создано')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Обновлено')),
                ('account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='forecasts', to='main.account', verbose_name='Счёт')),
                ('category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='forecasts', to='main.budgetcategory', verbose_name='Категория бюджета')),
                ('user', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='forecasts', to=settings.AUTH_USER_MODEL, verbose_name='Пользователь')),
            ],
            options={
                'verbose_name': 'Прогноз',
                'verbose_name_plural': 'Прогнозы',
                'ordering': ['-date'],
            },
        ),
        migrations.AddIndex(
            model_name='forecast',
            index=models.Index(fields=['user', 'date'], name='forecast_user_date_idx'),
        ),
    ]
