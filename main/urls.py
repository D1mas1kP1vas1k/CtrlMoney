from django.urls import path
from . import views
from django.contrib.auth.views import logout_then_login

app_name = 'main'

urlpatterns = [
    path('login/', views.login, name='login'),
    path('register/', views.register, name='register'),
    path('logout/', logout_then_login, {'login_url': 'main:login'}, name='logout'),
    path('account-locked/', views.account_locked, name='account_locked'),
    path('', views.index, name='index'),
    path('profile/', views.profile, name='profile'),
]
