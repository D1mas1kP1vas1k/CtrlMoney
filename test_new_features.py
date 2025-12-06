#!/usr/bin/env python
"""
Скрипт для проверки установки и функциональности новых компонентов CtrlMoney
"""

import os
import sys
import django

# Добавляем текущую директорию в path
sys.path.insert(0, os.path.dirname(__file__))

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ctrlmoney.settings')
django.setup()

from django.contrib.auth.models import User
from main.models import UserProfile
from main.captcha_utils import generate_captcha_sequence, verify_captcha_answer


def test_user_profile_creation():
    """Тест создания профиля пользователя"""
    print("\n" + "="*60)
    print("TEST 1: Создание профиля пользователя")
    print("="*60)
    
    # Создаем тестового пользователя
    test_user = User.objects.create_user(
        username='testuser123',
        email='test@example.com',
        password='testpass123'
    )
    
    # Проверяем что профиль создан автоматически
    assert hasattr(test_user, 'profile'), "Профиль не создан автоматически!"
    print("✓ Профиль создан автоматически")
    
    # Обновляем ФИО
    profile = test_user.profile
    profile.first_name = 'Иван'
    profile.last_name = 'Иванов'
    profile.patronymic = 'Иванович'
    profile.save()
    
    print(f"✓ ФИО сохранено: {profile.full_name}")
    
    # Очищаем
    test_user.delete()
    print("✓ Тест успешно пройден!\n")


def test_captcha_functions():
    """Тест функций капчи"""
    print("="*60)
    print("TEST 2: Функции капчи")
    print("="*60)
    
    # Тест генерации последовательности
    sequence1 = generate_captcha_sequence()
    sequence2 = generate_captcha_sequence()
    
    print(f"✓ Последовательность 1: {sequence1}")
    print(f"✓ Последовательность 2: {sequence2}")
    
    # Проверяем что это перемешанные [1, 2, 3, 4]
    assert sorted(sequence1) == [1, 2, 3, 4], "Неправильная последовательность!"
    assert sorted(sequence2) == [1, 2, 3, 4], "Неправильная последовательность!"
    print("✓ Последовательности корректны")
    
    # Тест верификации
    assert verify_captcha_answer([1, 2, 3, 4]) == True, "Правильная последовательность не распознана!"
    print("✓ Правильная последовательность распознана")
    
    assert verify_captcha_answer([1, 2, 4, 3]) == False, "Неправильная последовательность распознана как правильная!"
    print("✓ Неправильная последовательность отклонена")
    
    assert verify_captcha_answer([1, 2, 3, None]) == False, "Неполная последовательность распознана как правильная!"
    print("✓ Неполная последовательность отклонена")
    
    print("✓ Тест успешно пройден!\n")


def test_model_fields():
    """Тест полей модели UserProfile"""
    print("="*60)
    print("TEST 3: Поля модели UserProfile")
    print("="*60)
    
    # Создаем профиль
    test_user = User.objects.create_user(
        username='fieldtest',
        email='field@test.com',
        password='testpass123'
    )
    
    profile = test_user.profile
    
    # Проверяем поля
    fields = {
        'user': profile.user,
        'first_name': profile.first_name,
        'last_name': profile.last_name,
        'patronymic': profile.patronymic,
        'created_at': profile.created_at,
        'updated_at': profile.updated_at,
    }
    
    for field_name, field_value in fields.items():
        if field_name in ['first_name', 'last_name', 'patronymic']:
            print(f"✓ Поле '{field_name}': {field_value if field_value else '(пусто)'}")
        else:
            print(f"✓ Поле '{field_name}': существует")
    
    print("✓ Все поля присутствуют\n")
    
    # Очищаем
    test_user.delete()
    print("✓ Тест успешно пройден!\n")


def main():
    """Главная функция"""
    print("\n" + "█"*60)
    print("█ ТЕСТИРОВАНИЕ НОВЫХ ФУНКЦИЙ CTRLMONEY")
    print("█"*60)
    
    try:
        test_user_profile_creation()
        test_captcha_functions()
        test_model_fields()
        
        print("█"*60)
        print("█ ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ! ✓")
        print("█"*60 + "\n")
        
        print("Дополнительная информация:")
        print("- Модель UserProfile успешно создана и работает")
        print("- Функции капчи работают корректно")
        print("- Все поля доступны и сохраняются правильно")
        print("\nДалее нужно:")
        print("1. Запустить Django сервер: python manage.py runserver")
        print("2. Открыть страницу регистрации и проверить новые поля ФИО")
        print("3. Попробовать собрать пазл-капчу")
        print("4. Проверить профиль пользователя в админ-панели")
        
    except Exception as e:
        print(f"\n✗ ОШИБКА: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
