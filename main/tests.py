"""
Тесты для системы блокировки аккаунтов
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from main.models import UserProfile
from datetime import timedelta


class AccountBlockingTests(TestCase):
    """Тесты функциональности блокировки аккаунтов"""
    
    def setUp(self):
        """Подготовка к тестам"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='correctpassword123',
            first_name='Test',
            last_name='User'
        )
        self.profile = self.user.profile
    
    def test_userprofile_created_on_user_creation(self):
        """Проверить, что профиль создаётся автоматически"""
        self.assertTrue(hasattr(self.user, 'profile'))
        self.assertFalse(self.profile.is_blocked)
        self.assertEqual(self.profile.failed_login_attempts, 0)
        self.assertIsNone(self.profile.blocked_at)
    
    def test_failed_login_increases_counter(self):
        """Проверить, что неудачный вход увеличивает счетчик"""
        response = self.client.post('/login/', {
            'username': 'testuser',
            'password': 'wrongpassword',
            'captcha_passed': '1'
        }, follow=True)
        
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.failed_login_attempts, 1)
    
    def test_successful_login_resets_counter(self):
        """Проверить, что успешный вход сбрасывает счетчик"""
        # Сначала делаем несколько неудачных попыток
        for _ in range(2):
            self.client.post('/login/', {
                'username': 'testuser',
                'password': 'wrongpassword',
                'captcha_passed': '1'
            })
        
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.failed_login_attempts, 2)
        
        # Теперь успешный вход
        response = self.client.post('/login/', {
            'username': 'testuser',
            'password': 'correctpassword123',
            'captcha_passed': '1'
        })
        
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.failed_login_attempts, 0)
    
    def test_account_blocks_after_three_failed_attempts(self):
        """Проверить, что аккаунт блокируется после 3 неудачных попыток"""
        for i in range(3):
            self.client.post('/login/', {
                'username': 'testuser',
                'password': 'wrongpassword',
                'captcha_passed': '1'
            })
        
        self.profile.refresh_from_db()
        self.assertTrue(self.profile.is_blocked)
        self.assertEqual(self.profile.failed_login_attempts, 3)
        self.assertIsNotNone(self.profile.blocked_at)
    
    def test_blocked_user_cannot_login(self):
        """Проверить, что заблокированный пользователь не может войти"""
        # Заблокируем пользователя
        self.profile.is_blocked = True
        self.profile.blocked_at = timezone.now()
        self.profile.save()
        
        # Попытка входа должна перенаправить на страницу блокировки
        response = self.client.post('/login/', {
            'username': 'testuser',
            'password': 'correctpassword123',
            'captcha_passed': '1'
        }, follow=True)
        
        self.assertIn('/account-locked/', response.request['PATH_INFO'])
    
    def test_admin_can_block_user(self):
        """Проверить, что администратор может заблокировать пользователя"""
        self.assertFalse(self.profile.is_blocked)
        
        self.profile.is_blocked = True
        self.profile.blocked_at = timezone.now()
        self.profile.save()
        
        self.profile.refresh_from_db()
        self.assertTrue(self.profile.is_blocked)
    
    def test_admin_can_unblock_user(self):
        """Проверить, что администратор может разблокировать пользователя"""
        # Сначала заблокируем
        self.profile.is_blocked = True
        self.profile.blocked_at = timezone.now()
        self.profile.failed_login_attempts = 3
        self.profile.save()
        
        # Затем разблокируем
        self.profile.is_blocked = False
        self.profile.blocked_at = None
        self.profile.failed_login_attempts = 0
        self.profile.save()
        
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.is_blocked)
        self.assertIsNone(self.profile.blocked_at)
        self.assertEqual(self.profile.failed_login_attempts, 0)
    
    def test_blocked_user_page_exists(self):
        """Проверить, что страница заблокированного аккаунта доступна"""
        response = self.client.get('/account-locked/?username=testuser')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'testuser', response.content)
        # Проверяем, что это русский текст (кириллица)
        self.assertIn('аккаунт', response.content.decode('utf-8').lower())


class LoginViewTests(TestCase):
    """Тесты представления входа"""
    
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
    
    def test_login_page_get_request(self):
        """Проверить, что страница входа загружается"""
        response = self.client.get('/login/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'login', response.content.lower())
    
    def test_login_requires_captcha(self):
        """Проверить, что капча требуется для входа"""
        response = self.client.post('/login/', {
            'username': 'testuser',
            'password': 'testpass123',
            'captcha_passed': '0'
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'captcha', response.content.lower())
    
    def test_register_page_exists(self):
        """Проверить, что страница регистрации доступна"""
        response = self.client.get('/register/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'register', response.content.lower())
