from django.urls import path

from . import views

app_name = 'forecast'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/accounts/', views.api_accounts, name='api_accounts'),
    path('api/transactions/', views.api_transactions, name='api_transactions'),
    path('api/goals/', views.api_goals, name='api_goals'),
    path('api/categories/', views.api_budget_categories, name='api_budget_categories'),
    path('api/categories/save/', views.api_save_category, name='api_save_category'),
    path('api/categories/delete/', views.api_delete_category, name='api_delete_category'),
    path('api/goals/save/', views.api_save_goal_forecast, name='api_save_goal_forecast'),
    path('api/goals/delete/', views.api_delete_goal_forecast, name='api_delete_goal_forecast'),
]
