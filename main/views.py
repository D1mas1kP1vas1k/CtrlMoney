from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.http import JsonResponse
from django.utils import timezone
from django.urls import reverse
from datetime import timedelta
from .models import UserProfile
from .captcha_utils import get_captcha_pieces
import random


@require_http_methods(["GET"])
@ensure_csrf_cookie
def account_locked(request):
    """Страница с информацией о заблокированном аккаунте"""
    username = request.GET.get('username', '')
    return render(request, 'main/account_locked.html', {
        'username': username,
    })


@require_http_methods(["GET", "POST"])
@ensure_csrf_cookie
@csrf_protect
def login(request):
    """Представление для входа пользователя с защитой от перебора пароля"""
    if request.method == 'POST':
        username = request.POST.get('username', '')
        password = request.POST.get('password', '')
        captcha_passed = request.POST.get('captcha_passed', '0')
        
        # Проверяем что капча пройдена
        if captcha_passed != '1':
            return render(request, 'main/login.html', {
                'error': 'Пожалуйста, пройдите проверку капчей',
                'username': username,
                'captcha_pieces': get_captcha_pieces(),
            })
        
        try:
            user = User.objects.get(username=username)
            profile = user.profile
            
            # Проверяем что аккаунт не заблокирован
            if profile.is_blocked:
                return redirect(f"{reverse('main:account_locked')}?username={username}")
            
            # Пытаемся аутентифицировать пользователя
            authenticated_user = authenticate(username=username, password=password)
            
            if authenticated_user is not None:
                # Успешный вход - сбрасываем счетчик неудачных попыток
                profile.failed_login_attempts = 0
                profile.save()
                
                # Логируемся
                auth_login(request, authenticated_user)
                return redirect('main:index')
            else:
                # Неудачная попытка входа
                profile.failed_login_attempts += 1
                
                if profile.failed_login_attempts >= 3:
                    # Блокируем аккаунт после 3 неудачных попыток
                    profile.is_blocked = True
                    profile.blocked_at = timezone.now()
                    profile.save()
                    
                    return redirect(f"{reverse('main:account_locked')}?username={username}")
                else:
                    remaining_attempts = 3 - profile.failed_login_attempts
                    profile.save()
                    
                    return render(request, 'main/login.html', {
                        'error': f'Неверные данные. Осталось попыток: {remaining_attempts}',
                        'username': username,
                        'captcha_pieces': get_captcha_pieces(),
                    })
        
        except User.DoesNotExist:
            # Пользователь не найден
            return render(request, 'main/login.html', {
                'error': 'Пользователь не найден',
                'username': username,
                'captcha_pieces': get_captcha_pieces(),
            })
    
    # GET запрос - показываем форму входа
    return render(request, 'main/login.html', {
        'captcha_pieces': get_captcha_pieces(),
    })


@require_http_methods(["GET", "POST"])
@ensure_csrf_cookie
@csrf_protect
def register(request):
    """Представление для регистрации пользователя"""
    if request.method == 'POST':
        username = request.POST.get('username', '')
        password = request.POST.get('password', '')
        password_confirm = request.POST.get('password_confirm', '')
        first_name = request.POST.get('first_name', '')
        last_name = request.POST.get('last_name', '')
        captcha_passed = request.POST.get('captcha_passed', '0')
        
        # Проверяем что капча пройдена
        if captcha_passed != '1':
            return render(request, 'main/register.html', {
                'error': 'Пожалуйста, пройдите проверку капчей',
                'captcha_pieces': get_captcha_pieces(),
            })
        
        # Проверяем пароли
        if password != password_confirm:
            return render(request, 'main/register.html', {
                'error': 'Пароли не совпадают',
                'captcha_pieces': get_captcha_pieces(),
            })
        
        # Проверяем длину пароля
        if len(password) < 6:
            return render(request, 'main/register.html', {
                'error': 'Пароль должен быть не менее 6 символов',
                'captcha_pieces': get_captcha_pieces(),
            })
        
        # Проверяем что пользователь уже не существует
        if User.objects.filter(username=username).exists():
            return render(request, 'main/register.html', {
                'error': 'Пользователь с таким именем уже существует',
                'captcha_pieces': get_captcha_pieces(),
            })
        
        # Создаем пользователя
        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        # Обновляем профиль
        profile = user.profile
        profile.first_name = first_name
        profile.last_name = last_name
        profile.save()
        
        # Логируемся
        auth_login(request, user)
        return redirect('main:index')
    
    # GET запрос - показываем форму регистрации
    return render(request, 'main/register.html', {
        'captcha_pieces': get_captcha_pieces(),
    })


@login_required(login_url='main:login')
def index(request):
    """Главная страница приложения"""
    return render(request, 'main/index.html')


@login_required(login_url='main:login')
def profile(request):
    """Страница профиля пользователя"""
    return render(request, 'main/profile.html')
