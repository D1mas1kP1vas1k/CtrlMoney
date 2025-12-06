"""
Утилиты для работы с капчой и валидацией
"""
import random
import re


def generate_captcha_sequence():
    """
    Генерирует случайную последовательность для капчи (пазла).
    Возвращает перемешанный список [1, 2, 3, 4]
    """
    pieces = [1, 2, 3, 4]
    random.shuffle(pieces)
    return pieces


def verify_captcha_answer(placed_pieces):
    """
    Проверяет, правильно ли собрана капча.
    
    Args:
        placed_pieces: список из 4 элементов с размещенными номерами пазлов
        
    Returns:
        bool: True если порядок правильный [1, 2, 3, 4], False иначе
    """
    correct_order = [1, 2, 3, 4]
    
    # Проверяем, что все элементы размещены
    if not placed_pieces or len(placed_pieces) != 4:
        return False
    
    # Проверяем все ли элементы не None
    if any(piece is None for piece in placed_pieces):
        return False
    
    # Проверяем правильность порядка
    return placed_pieces == correct_order


def validate_fio(first_name, last_name, patronymic=None):
    """
    Проверяет корректность ФИО.
    
    Правила:
    - Содержит только буквы (кириллица и латиница), дефис, апостроф
    - Минимум 2 символа для каждого поля
    - Максимум 100 символов для каждого поля
    - Не начинается и не заканчивается на дефис/апостроф
    - Нет цифр, специальных символов, пробелов
    
    Args:
        first_name (str): Имя
        last_name (str): Фамилия
        patronymic (str, optional): Отчество
        
    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    # Паттерн для проверки: буквы (кириллица, латиница), дефис, апостроф
    # Кириллица: \u0400-\u04FF
    # Латиница: a-zA-Z
    name_pattern = r"^[а-яА-ЯёЁa-zA-Z\-']+$"
    
    def validate_single_name(name, field_name):
        """Проверить отдельное поле имени"""
        if not name or not isinstance(name, str):
            return False, f"{field_name} не может быть пустым"
        
        name = name.strip()
        
        if len(name) < 2:
            return False, f"{field_name} должно содержать минимум 2 символа"
        
        if len(name) > 100:
            return False, f"{field_name} должно содержать максимум 100 символов"
        
        if not re.match(name_pattern, name):
            return False, f"{field_name} может содержать только буквы, дефис и апостроф. Без цифр и спецсимволов!"
        
        if name.startswith('-') or name.startswith("'"):
            return False, f"{field_name} не может начинаться с дефиса или апострофа"
        
        if name.endswith('-') or name.endswith("'"):
            return False, f"{field_name} не может заканчиваться на дефис или апостроф"
        
        # Проверка на двойные дефисы/апострофы
        if '--' in name or "''" in name:
            return False, f"{field_name} не может содержать двойные дефисы или апострофы"
        
        return True, None
    
    # Проверка фамилии
    is_valid, error = validate_single_name(last_name, "Фамилия")
    if not is_valid:
        return False, error
    
    # Проверка имени
    is_valid, error = validate_single_name(first_name, "Имя")
    if not is_valid:
        return False, error
    
    # Проверка отчества (если указано)
    if patronymic:
        is_valid, error = validate_single_name(patronymic, "Отчество")
        if not is_valid:
            return False, error
    
    return True, None


def sanitize_fio(first_name, last_name, patronymic=None):
    """
    Очищает ФИО от лишних пробелов.
    
    Args:
        first_name (str): Имя
        last_name (str): Фамилия
        patronymic (str, optional): Отчество
        
    Returns:
        tuple: (cleaned_first_name, cleaned_last_name, cleaned_patronymic)
    """
    first_name = first_name.strip() if first_name else ""
    last_name = last_name.strip() if last_name else ""
    patronymic = patronymic.strip() if patronymic else ""
    
    return first_name, last_name, patronymic

