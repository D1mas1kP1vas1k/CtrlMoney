// Вспомогательная функция для получения CSRF токена из cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const accountTypeEmoji = {
    deposit: '🏦',
    debit: '💳',
    credit: '🧾',
    savings: '🏖',
    investment: '📈',
    cash: '💵',
    other: '🏷️'
};

function escapeHtml(str = '') {
    return String(str).replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

function formatNumber(value = 0) {
    const number = Number(value) || 0;
    return new Intl.NumberFormat('ru-RU').format(number);
}

function adjustFontSize(element, text, type = 'large') {
    if (!element) return;
    const length = text.length;
    const baseSize = { small: 1, medium: 1.1, large: 1.2 };
    const minSizes = { small: 0.45, medium: 0.85, large: 0.65 };
    let fontSize = baseSize[type] || 1;
    fontSize *= length <= 8 ? 1 : Math.max(0.4, 1 - (length - 8) * 0.05);
    fontSize = Math.max(fontSize, minSizes[type] || 0.5);
    element.style.fontSize = `${fontSize}em`;
    element.style.whiteSpace = 'normal';
}

function updateBalanceValue(incomeSum = 0, expensesSum = 0) {
    const balanceText = document.getElementById('balanceText');
    if (!balanceText) return;
    const net = incomeSum - expensesSum;
    const value = `${formatNumber(net)}₽`;
    balanceText.textContent = value;
    adjustFontSize(balanceText, value, 'large');
}

function renderAccountsList(accounts = []) {
    const accountsList = document.getElementById('accountsList');
    if (!accountsList) return;

    if (!accounts.length) {
        accountsList.innerHTML = '<div class="menu-account no-accounts"><div class="menu-account-info" style="padding:.6em; text-align:center; color:#666; width:100%;">Нет счетов</div></div>';
        return;
    }

    accountsList.innerHTML = '';
    accounts.forEach((acc) => {
        const emoji = accountTypeEmoji[acc.account_type || acc.type] || accountTypeEmoji.other;
        const amount = formatNumber(acc.amount) + '₽';
        const item = document.createElement('div');
        item.className = 'menu-account';
        item.innerHTML = `
            <div class="menu-account-circle">
                <div class="menu-account-img"><span>${emoji}</span></div>
            </div>
            <div class="menu-account-info">
                <p class="account-name">${escapeHtml(acc.name || 'Счет')}</p>
                <p class="account-amount">${amount}</p>
            </div>
        `;
        accountsList.appendChild(item);
    });
}

function renderForecastAccounts(accounts = []) {
    const forecastAccountsList = document.getElementById('forecastAccountsList');
    if (!forecastAccountsList) return;
    forecastAccountsList.innerHTML = '';
    accounts.forEach(acc => {
        const el = document.createElement('div');
        el.className = 'menu-account';
        el.innerHTML = `
            <div class="menu-account-circle">
                <div class="menu-account-img">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" stroke="#FF5858" stroke-width="2" fill="none"/>
                    </svg>
                </div>
            </div>
            <div class="menu-account-info">
                <span>${escapeHtml(acc.name || 'Счет')}</span>
                <span class="account-amount">${formatNumber(acc.amount)}₽</span>
            </div>`;
        forecastAccountsList.appendChild(el);
    });
}

async function loadAccountsFromServer() {
    try {
        const response = await fetch('/api/accounts/', {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            credentials: 'same-origin'
        });
        const data = await response.json();
        if (data.success && Array.isArray(data.accounts)) {
            accounts = data.accounts.map(acc => ({
                id: acc.id,
                name: acc.name,
                amount: parseFloat(acc.amount) || 0,
                account_type: acc.account_type,
                description: acc.description || ''
            }));
            renderAccountsList(accounts);
            renderForecastAccounts(accounts);
        }
    } catch (error) {
        console.error('Не удалось загрузить счета:', error);
        renderAccountsList(accounts);
        renderForecastAccounts(accounts);
    }
}

let incomeTransactions = [];
let expensesTransactions = [];
let accounts = [];
let goals = [];
let categories = [];

console.log('script.js loaded successfully');

document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOMContentLoaded event triggered');
    incomeTransactions = [];
    expensesTransactions = [];
    accounts = [];
    goals = [];
    categories = [];
    
    if (window.forecastData) {
        console.log('window.forecastData exists:', window.forecastData);

        accounts = window.forecastData.accounts || [];
        const allTransactions = window.forecastData.transactions || [];
        goals = window.forecastData.goals || [];
        
        incomeTransactions = allTransactions.filter(t => t.transaction_type === 'income').map(t => ({ 
            id: t.id, 
            name: t.name, 
            amount: parseFloat(t.amount), 
            category: t.category, 
            date: t.date 
        }));
        
        expensesTransactions = allTransactions.filter(t => t.transaction_type === 'expense').map(t => ({ 
            id: t.id, 
            name: t.name, 
            amount: parseFloat(t.amount), 
            category: t.category, 
            date: t.date 
        }));
        
        categories = window.forecastData.categories || [];
    }
    
    updateBalanceValue(
        incomeTransactions.reduce((s,t)=>s+(t.amount||0),0),
        expensesTransactions.reduce((s,t)=>s+(t.amount||0),0)
    );

    renderAccountsList(accounts);
    renderForecastAccounts(accounts);
    await loadAccountsFromServer();

    function filterByRange(transactions, range) {
        const now = new Date();
        return transactions.filter(t => {
            const d = new Date(t.date);
            const diff = (now - d) / (1000 * 60 * 60 * 24);
            if (range === 'week') return diff <= 7;
            if (range === 'month') return diff <= 30;
            return diff <= 365;
        });
    }

    function getMonthlyData(arr) {
        const m = {};
        arr.forEach(t => {
            const d = new Date(t.date);
            const k = `${d.getFullYear()}-${d.getMonth() + 1}`;
            m[k] = (m[k] || 0) + t.amount;
        });
        return m;
    }

    let charts = {};
    function renderCharts(incomeData, expenseData) {
        Object.values(charts).forEach(c => c.destroy && c.destroy());

        const ctxCat = document.getElementById('expensesByCategoryChart');
        const ctxMonth = document.getElementById('incomeExpenseByMonthChart');
        const ctxSavings = document.getElementById('balanceOverTimeChart');

        if (!ctxCat || !ctxMonth || !ctxSavings) return;

        const expensesByCategory = {};
        expenseData.forEach(t => expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount);
        const sortedCats = Object.entries(expensesByCategory).sort((a,b)=>b[1]-a[1]);
        const catLabels = sortedCats.map(c=>c[0]);
        const catValues = sortedCats.map(c=>c[1]);
        const totalExp = catValues.reduce((a,b)=>a+b,0) || 0;

        charts.cat = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: catLabels,
                datasets: [{ data: catValues, backgroundColor: ['#FF5858','#FF9F40','#FFD166','#4BC0C0','#5C7AEA','#9966FF'] }]
            },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Распределение расходов' },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toLocaleString()}₽ (${totalExp > 0 ? ((ctx.parsed/totalExp)*100).toFixed(1) : 0}%)` } }
                }
            },
            plugins: [{
                id: 'centerText',
                beforeDraw(chart) {
                    const {ctx, chartArea} = chart;
                    const x = (chartArea.left + chartArea.right) / 2;
                    const y = (chartArea.top + chartArea.bottom) / 2;
                    ctx.save();
                    ctx.font = 'bold 16px Inter';
                    ctx.fillStyle = '#333';
                    ctx.textAlign = 'center';
                    ctx.fillText(totalExp.toLocaleString() + '₽', x, y);
                    ctx.restore();
                }
            }]
        });

        const mInc = getMonthlyData(incomeData);
        const mExp = getMonthlyData(expenseData);
        const months = [...new Set([...Object.keys(mInc), ...Object.keys(mExp)])].sort();
        const monthlyBalance = months.map(m => (mInc[m]||0)-(mExp[m]||0));

        charts.month = new Chart(ctxMonth, {
            data: {
                labels: months,
                datasets: [
                    { type: 'bar', label: 'Доходы', data: months.map(m=>mInc[m]||0), backgroundColor: 'rgba(76,175,80,0.6)', borderRadius: 6 },
                    { type: 'bar', label: 'Расходы', data: months.map(m=>mExp[m]||0), backgroundColor: 'rgba(255,88,88,0.6)', borderRadius: 6 },
                    { type: 'line', label: 'Баланс', data: monthlyBalance, borderColor: '#2196F3', borderWidth: 2, tension: 0.3, pointRadius: 3 }
                ]
            },
            options: {
                animation: { duration: 600, easing: 'easeInOutCubic' },
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Доходы, расходы и баланс' }
                },
                scales: {
                    x: { grid: { color: '#eee' } },
                    y: { beginAtZero: true, grid: { color: '#eee' }, ticks: { callback: v => v.toLocaleString() + '₽' } }
                }
            }
        });

        let cum = 0;
        const savings = months.map(m => cum += (mInc[m]||0)-(mExp[m]||0));
        const avg = savings.length ? (savings[savings.length-1]/savings.length) : 0;

        charts.savings = new Chart(ctxSavings, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    { label: 'Накопления', data: savings, borderColor: '#673AB7', borderWidth: 3, tension: 0.4, pointRadius: 4 },
                    { label: 'Средний уровень', data: new Array(months.length).fill(avg), borderColor: '#999', borderDash: [5,5], borderWidth: 1.5, pointRadius: 0 }
                ]
            },
            options: {
                animation: { duration: 600, easing: 'easeInOutCubic' },
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Динамика накоплений' },
                    tooltip: { callbacks: { label: ctx => ctx.parsed.y.toLocaleString()+'₽' } }
                },
                scales: {
                    x: { grid: { color: '#eee' } },
                    y: { beginAtZero: true, grid: { color: '#eee' }, ticks: { callback: v => v.toLocaleString()+'₽' } }
                }
            }
        });
    }

    document.querySelectorAll('.chart-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.chart-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            const range = btn.dataset.range;
            const inc = filterByRange(incomeTransactions, range);
            const exp = filterByRange(expensesTransactions, range);
            renderCharts(inc, exp);
        });
    });

    let currentMonth = new Date();
    categories = window.forecastData.categories && window.forecastData.categories.length > 0 
        ? window.forecastData.categories 
        : JSON.parse(localStorage.getItem('categories')) || [];

    function getEmoji(category) {
        const map = {
            'еда': '🍔',
            'транспорт': '🚌',
            'развлечения': '🎮',
            'жилье': '🏠',
            'здоровье': '💊',
            'одежда': '👕',
            'другое': '💡',
            'доход': '💰'
        }
        return map[category] || '💸';
    }

    const allCategoriesList = ['еда', 'транспорт', 'развлечения', 'жилье', 'здоровье', 'одежда', 'другое'];

    function getAvailableFunds() {
        const totalIncome = incomeTransactions.reduce((s, t) => s + (t.amount || 0), 0);
        const totalExpenses = expensesTransactions.reduce((s, t) => s + (t.amount || 0), 0);
        return totalIncome - totalExpenses;
    }

    function updateCurrentMonthDisplay() {
        const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
            "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
        const elem = document.getElementById('currentMonth');
        if (elem) {
            elem.textContent = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
        }
    }

    function calculateMonthlySummary() {
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        
        const monthlyIncome = incomeTransactions
            .filter(t => {
                const tDate = new Date(t.date);
                return tDate >= monthStart && tDate <= monthEnd;
            })
            .reduce((sum, t) => sum + t.amount, 0);
        
        const monthlyExpenses = expensesTransactions
            .filter(t => {
                const tDate = new Date(t.date);
                return tDate >= monthStart && tDate <= monthEnd;
            })
            .reduce((sum, t) => sum + t.amount, 0);
        
        const surplus = monthlyIncome - monthlyExpenses;
        
        const incomeEl = document.getElementById('totalIncome');
        if (incomeEl) incomeEl.textContent = monthlyIncome.toLocaleString('ru-RU') + '₽';
        
        const expenseEl = document.getElementById('totalExpense');
        if (expenseEl) expenseEl.textContent = monthlyExpenses.toLocaleString('ru-RU') + '₽';
        
        const surplusEl = document.getElementById('monthlySurplus');
        if (surplusEl) surplusEl.textContent = surplus.toLocaleString('ru-RU') + '₽';
        
        const today = new Date();
        const daysInMonth = monthEnd.getDate();
        const daysPassed = Math.min(today.getDate(), daysInMonth);
        const dailyIncome = daysPassed > 0 ? monthlyIncome / daysPassed : 0;
        const dailyExpenses = daysPassed > 0 ? monthlyExpenses / daysPassed : 0;
        const forecast = (dailyIncome - dailyExpenses) * daysInMonth;
        
        const forecastEl = document.getElementById('forecastEnd');
        if (forecastEl) forecastEl.textContent = forecast.toLocaleString('ru-RU') + '₽';
    }

    function renderCategories() {
        const categoryList = document.getElementById('categoryList');
        if (!categoryList) return;
        
        categoryList.innerHTML = '';
        
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

        if (categories.length === 0) {
            if (window.forecastData && window.forecastData.categories && window.forecastData.categories.length > 0) {
                categories = window.forecastData.categories;
            } else {
                categories = allCategoriesList.map(cat => ({
                    name: cat,
                    budget: 0,
                    emoji: getEmoji(cat)
                }));
            }
        }

        categories.forEach((cat, index) => {
            const spent = expensesTransactions
                .filter(t => {
                    const tDate = new Date(t.date);
                    return t.category === cat.name && tDate >= monthStart && tDate <= monthEnd;
                })
                .reduce((sum, t) => sum + t.amount, 0);
            
            const progress = cat.budget > 0 ? Math.min((spent / cat.budget) * 100, 100) : 0;
            
            let statusClass = '';
            let statusMessage = '';
            let statusEmoji = '';
            
            if (cat.budget === 0) {
                statusClass = 'no-budget';
                statusMessage = 'Бюджет не установлен';
                statusEmoji = '📝';
            } else if (spent > cat.budget) {
                statusClass = 'over-budget';
                const overspent = spent - cat.budget;
                statusMessage = `Превышен на ${overspent.toLocaleString('ru-RU')}₽`;
                statusEmoji = '🚨';
            } else if (progress >= 90) {
                statusClass = 'warning';
                statusMessage = 'Почти достигнут лимит';
                statusEmoji = '⚠️';     
            } else {
                statusClass = 'good';
                statusMessage = 'В пределах нормы';
                statusEmoji = '✅';
            }
            
            const catEl = document.createElement('div');
            catEl.className = `category-item ${statusClass}`;
            catEl.innerHTML = `
                <div class="category-header">
                    <div class="category-title">
                        <span class="category-emoji">${cat.emoji || getEmoji(cat.name)}</span>
                        <span class="category-name">${cat.name}</span>
                    </div>
                    <div class="category-amounts">
                        <span class="spent">${spent.toLocaleString('ru-RU')}₽</span>
                        <span class="budget"> / ${cat.budget.toLocaleString('ru-RU')}₽</span>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="category-footer">
                    <div class="category-status">
                        <span class="status-emoji">${statusEmoji}</span>
                        <span class="status-text">${statusMessage}</span>
                    </div>
                    <div class="category-actions">
                        <button onclick="editCategory(${index})">✏️</button>
                        <button onclick="deleteCategory(${index})">✕</button>
                    </div>
                </div>
            `;
            categoryList.appendChild(catEl);
        });
    }

    function renderGoals() {
        const goalsList = document.getElementById('goalsList');
        if (!goalsList) return;

        goalsList.innerHTML = '';

        const freeMoney = incomeTransactions.reduce((s, t) => s + t.amount, 0) - expensesTransactions.reduce((s, t) => s + t.amount, 0);

        goals.forEach((goal, index) => {
            let accountsSum = 0;
            let connectedAccountsList = [];

            if (goal.accounts && goal.accounts.length > 0) {
                goal.accounts.forEach(accId => {
                    const account = accounts.find(a => a.id === accId);
                    if (account) {
                        accountsSum += account.amount || 0;
                        connectedAccountsList.push({
                            id: account.id,
                            name: account.name,
                            amount: account.amount || 0
                        });
                    }
                });
            }

            const useOnlyAccounts = goal.use_only_accounts === true;
            const accumulated = useOnlyAccounts 
                ? accountsSum 
                : freeMoney + accountsSum;

            const totalProgress = goal.target > 0 ? Math.min((accumulated / goal.target) * 100, 100) : 0;
            const canAfford = accumulated >= goal.target;
            const isOverBudget = accumulated > goal.target;

            let statusText = '';
            let emoji = '';

            if (isOverBudget) {
                statusText = 'Цель перевыполнена!';
                emoji = '🎉';
            } else if (canAfford) {
                statusText = 'Цель достигнута!';
                emoji = '✅';
            } else if (totalProgress >= 80) {
                statusText = 'Почти у цели!';
                emoji = '🔥';
            } else if (totalProgress >= 50) {
                statusText = 'На полпути!';
                emoji = '📈';
            } else if (totalProgress >= 25) {
                statusText = 'Есть прогресс!';
                emoji = '👍';
            } else {
                statusText = 'В процессе...';
                emoji = '⏳';
            }

            const accountsCount = connectedAccountsList.length;
            const accountsInfo = accountsCount > 0 
                ? `${accountsCount} ${accountsCount === 1 ? 'счёт' : accountsCount < 5 ? 'счёта' : 'счетов'}: ${formatNumber(accountsSum)}₽`
                : 'Счета не подключены';

            const accountsDetails = connectedAccountsList.length > 0
                ? connectedAccountsList.map(acc => `${acc.name} (${formatNumber(acc.amount)}₽)`).join(', ')
                : '';

            const goalEl = document.createElement('div');
            goalEl.className = `goal-item ${canAfford ? 'affordable' : ''} ${isOverBudget ? 'over-budget' : ''}`;
            goalEl.innerHTML = `
                <div class="goal-header">
                    <span>${escapeHtml(goal.name)} ${emoji}</span>
                    <span>${formatNumber(goal.target)}₽</span>
                </div>
                
                <div class="progress-section">
                    <div class="progress-label">
                        <span>Накоплено:</span>
                        <span>${formatNumber(accumulated)}₽ / ${formatNumber(goal.target)}₽ (${totalProgress.toFixed(1)}%)</span>
                    </div>
                    <div class="progress-bar total-progress">
                        <div class="progress-fill" style="width: ${totalProgress}%"></div>
                    </div>
                </div>
                
                <div class="goal-accounts" style="margin-top: 0.5em; font-size: 0.85em; color: #666;">
                    <div style="margin-bottom: 0.3em;">
                        <span>📊 ${accountsInfo}</span>
                        ${useOnlyAccounts ? '<span style="color: #ff5858; margin-left: 0.5em; font-weight:500;">(только счета)</span>' : ''}
                    </div>
                    ${accountsDetails ? `<div style="font-size: 0.9em; color: #888; margin-top: 0.2em;">${accountsDetails}</div>` : ''}
                </div>
                
                <div class="goal-footer">
                    <div class="goal-status">
                        <span class="status-text ${isOverBudget ? 'over-text' : canAfford ? 'success-text' : ''}">
                            ${statusText}
                        </span>
                        <button onclick="editGoal(${index})">✏️</button>
                        <button onclick="deleteGoal(${index})">✕</button>
                    </div>
                </div>
            `;
            goalsList.appendChild(goalEl);
        });
    }

    function renderMonthAnalyticsChart() {
        const ctx = document.getElementById('categoryProgressChart');
        if (!ctx) return;
        
        if (window.categoryProgressChartInstance) {
            window.categoryProgressChartInstance.destroy();
        }
        
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        
        const categoryData = {};
        categories.forEach(cat => {
            const spent = expensesTransactions
                .filter(t => {
                    const tDate = new Date(t.date);
                    return t.category === cat.name && tDate >= monthStart && tDate <= monthEnd;
                })
                .reduce((sum, t) => sum + t.amount, 0);
            
            categoryData[cat.name] = {
                budget: cat.budget,
                spent: spent,
                remaining: Math.max(cat.budget - spent, 0)
            };
        });
        
        const categoryNames = Object.keys(categoryData);
        const budgetData = categoryNames.map(name => categoryData[name].budget);
        const spentData = categoryNames.map(name => categoryData[name].spent);
        const remainingData = categoryNames.map(name => categoryData[name].remaining);
        
        window.categoryProgressChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categoryNames,
                datasets: [
                    {
                        label: 'Бюджет',
                        data: budgetData,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Потрачено',
                        data: spentData,
                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Остаток',
                        data: remainingData,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Бюджет по категориям'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toLocaleString('ru-RU')}₽`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString('ru-RU') + '₽';
                            }
                        }
                    }
                }
            }
        });
    }

    function renderCashflowForecastChart() {
        const ctx = document.getElementById('cashflowForecastChart');
        if (!ctx) return;
        
        if (window.cashflowForecastChartInstance) {
            window.cashflowForecastChartInstance.destroy();
        }
        
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        const daysInMonth = monthEnd.getDate();
        
        const dailyData = [];
        let cumulativeBalance = 0;
        
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            
            const dayIncome = incomeTransactions
                .filter(t => {
                    const tDate = new Date(t.date);
                    return tDate.getDate() === day && 
                        tDate.getMonth() === currentMonth.getMonth() && 
                        tDate.getFullYear() === currentMonth.getFullYear();
                })
                .reduce((sum, t) => sum + t.amount, 0);
            
            const dayExpenses = expensesTransactions
                .filter(t => {
                    const tDate = new Date(t.date);
                    return tDate.getDate() === day && 
                        tDate.getMonth() === currentMonth.getMonth() && 
                        tDate.getFullYear() === currentMonth.getFullYear();
                })
                .reduce((sum, t) => sum + t.amount, 0);
            
            cumulativeBalance += (dayIncome - dayExpenses);
            dailyData.push({
                day: day,
                income: dayIncome,
                expenses: dayExpenses,
                balance: cumulativeBalance
            });
        }
        
        window.cashflowForecastChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyData.map(d => `День ${d.day}`),
                datasets: [
                    {
                        label: 'Баланс',
                        data: dailyData.map(d => d.balance),
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Доходы',
                        data: dailyData.map(d => d.income),
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: 'Расходы',
                        data: dailyData.map(d => d.expenses),
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Прогноз денежного потока'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toLocaleString('ru-RU')}₽`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString('ru-RU') + '₽';
                            }
                        }
                    }
                }
            }
        });
    }

    window.openModal = function(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }

    window.closeModal = function(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal.active');
            openModals.forEach(modal => {
                closeModal(modal.id);
            });
        }
    });

    const addCategoryBtn = document.getElementById('addCategoryBtn');
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', () => {
            const catSelect = document.getElementById('catSelect');
            if (catSelect) {
                catSelect.innerHTML = '<option value="">Выберите категорию</option>';
                allCategoriesList.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = `${getEmoji(cat)} ${cat}`;
                    catSelect.appendChild(option);
                });
            }
            openModal('categoryModal');
        });
    }

    window.editCategory = function(index) {
        const cat = categories[index];
        if (!cat) return;
        
        const catSelect = document.getElementById('catSelect');
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Выберите категорию</option>';
            allCategoriesList.forEach(catItem => {
                const option = document.createElement('option');
                option.value = catItem;
                option.textContent = `${getEmoji(catItem)} ${catItem}`;
                if (catItem === cat.name) {
                    option.selected = true;
                }
                catSelect.appendChild(option);
            });
        }
        
        const catBudgetInput = document.getElementById('catBudget');
        if (catBudgetInput) catBudgetInput.value = cat.budget;
        
        const saveButton = document.getElementById('saveCategory');
        if (saveButton) saveButton.dataset.editingIndex = index;
        
        openModal('categoryModal');
    };

    window.deleteCategory = async function(index) {
        if (!confirm('Удалить эту категорию?')) return;
        
        const category = categories[index];
        if (!category || !category.id) {
            alert('Невозможно удалить категорию');
            return;
        }
        
        try {
            const response = await fetch('/forecast/api/categories/delete/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ id: category.id })
            });
            
            const result = await response.json();
            if (result.success) {
                categories.splice(index, 1);
                renderCategories();
                renderMonthAnalyticsChart();
            } else {
                alert('Ошибка: ' + result.error);
            }
        } catch (error) {
            alert('Ошибка при удалении категории: ' + error.message);
        }
    };

    const saveCategoryBtn = document.getElementById('saveCategory');
    if (saveCategoryBtn) {
        saveCategoryBtn.addEventListener('click', async function() {
            const catSelect = document.getElementById('catSelect');
            const catBudgetInput = document.getElementById('catBudget');
            const name = catSelect ? catSelect.value : '';
            const budget = catBudgetInput ? parseFloat(catBudgetInput.value) : 0;
            const editingIndex = this.dataset.editingIndex;
            
            if (name && budget >= 0) {
                try {
                    const response = await fetch('/forecast/api/categories/save/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken')
                        },
                        body: JSON.stringify({
                            name: name,
                            budget: budget,
                            emoji: getEmoji(name)
                        })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        if (editingIndex !== undefined) {
                            categories[editingIndex] = result.category;
                        } else {
                            const existingIndex = categories.findIndex(cat => cat.id === result.category.id || cat.name === name);
                            if (existingIndex !== -1) {
                                categories[existingIndex] = result.category;
                            } else {
                                categories.push(result.category);
                            }
                        }
                        delete this.dataset.editingIndex;
                        renderCategories();
                        renderMonthAnalyticsChart();
                        closeModal('categoryModal');
                        if (catSelect) catSelect.value = '';
                        if (catBudgetInput) catBudgetInput.value = '';
                    } else {
                        alert('Ошибка: ' + result.error);
                    }
                } catch (error) {
                    alert('Ошибка при сохранении категории: ' + error.message);
                }
            } else {
                alert('Заполните все поля корректно');
            }
        });
    }

    async function loadGoals() {
        try {
            const res = await fetch('/forecast/api/goals/');
            const data = await res.json();
            if (data.success) {
                goals = data.goals;
                renderGoals();
            }
        } catch (e) {
            console.error('Ошибка загрузки целей:', e);
        }
    }

    const addGoalBtn = document.getElementById('addGoalBtn');
    if (addGoalBtn) {
        addGoalBtn.addEventListener('click', () => {
            document.getElementById('goalName').value = '';
            document.getElementById('goalTarget').value = '';
            document.getElementById('goalCurrent').value = '0';
            document.getElementById('goalOnlyAccounts').checked = false;

            const goalAccounts = document.getElementById('goalAccounts');
            goalAccounts.innerHTML = '';
            accounts.forEach(acc => {
                const label = document.createElement('label');
                label.className = 'account-checkbox-label';
                label.innerHTML = `
                    <input type="checkbox" class="account-checkbox" data-account-id="${acc.id}">
                    <span>${acc.name} - ${formatNumber(acc.amount)}₽</span>
                `;
                goalAccounts.appendChild(label);
            });

            const saveGoalBtn = document.getElementById('saveGoal');
            delete saveGoalBtn.dataset.editingId;

            const modalHeader = document.querySelector('#goalModal .modal-header h3');
            if (modalHeader) modalHeader.textContent = 'Новая цель';

            openModal('goalModal');
        });
    }

    const saveGoalBtn = document.getElementById('saveGoal');
    if (saveGoalBtn) {
        saveGoalBtn.addEventListener('click', async () => {
            const name = document.getElementById('goalName').value.trim();
            const target = parseFloat(document.getElementById('goalTarget').value) || 0;
            const current = parseFloat(document.getElementById('goalCurrent').value) || 0;
            const useOnlyAccounts = document.getElementById('goalOnlyAccounts').checked;
            const editingId = saveGoalBtn.dataset.editingId;

            if (!name || target <= 0) {
                alert('Заполните название и сумму');
                return;
            }

            const selectedAccounts = Array.from(document.querySelectorAll('.account-checkbox:checked'))
                .map(cb => parseInt(cb.dataset.accountId));

            try {
                await fetch('/forecast/api/goals/save/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({
                        id: editingId || null,
                        name,
                        target_amount: target,
                        current_amount: current,
                        use_only_accounts: useOnlyAccounts,
                        accounts: selectedAccounts
                    })
                });
                closeModal('goalModal');
                await loadGoals();
            } catch (e) {
                alert('Ошибка сохранения цели');
            }
        });
    }

    window.deleteGoal = async function (index) {
        const goal = goals[index];
        if (!confirm('Удалить цель?')) return;
        try {
            await fetch('/forecast/api/goals/delete/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ id: goal.id })
            });
            await loadGoals();
        } catch (e) {
            alert('Ошибка удаления');
        }
    };

    window.editGoal = function (index) {
        const goal = goals[index];
        if (!goal) return;

        const modalHeader = document.querySelector('#goalModal .modal-header h3');
        if (modalHeader) modalHeader.textContent = 'Редактировать цель';

        document.getElementById('goalName').value = goal.name;
        document.getElementById('goalTarget').value = goal.target;
        document.getElementById('goalCurrent').value = goal.current_amount || 0;
        document.getElementById('goalOnlyAccounts').checked = goal.use_only_accounts;

        const goalAccounts = document.getElementById('goalAccounts');
        goalAccounts.innerHTML = '';
        accounts.forEach(acc => {
            const isChecked = goal.accounts.includes(acc.id);
            const label = document.createElement('label');
            label.className = 'account-checkbox-label';
            label.innerHTML = `
                <input type="checkbox" class="account-checkbox" data-account-id="${acc.id}" ${isChecked ? 'checked' : ''}>
                <span>${acc.name} - ${formatNumber(acc.amount)}₽</span>
            `;
            goalAccounts.appendChild(label);
        });

        document.getElementById('saveGoal').dataset.editingId = goal.id;
        openModal('goalModal');
    };

    const prevMonthBtn = document.getElementById('prevMonth');
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() - 1);
            updatePlanningView();
        });
    }

    const nextMonthBtn = document.getElementById('nextMonth');
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            updatePlanningView();
        });
    }

    function updatePlanningView() {
        updateCurrentMonthDisplay();
        calculateMonthlySummary();
        renderCategories();
        renderGoals();
        renderMonthAnalyticsChart();
        renderCashflowForecastChart();
    }

    function refreshFinancialOverview() {
        const incomeTotal = incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const expenseTotal = expensesTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        updateBalanceValue(incomeTotal, expenseTotal);
        renderCharts(incomeTransactions, expensesTransactions);
        updatePlanningView();
    }

    function resetAccountModal() {
        const nameInput = document.getElementById('accountName');
        const amountInput = document.getElementById('accountAmount');
        const typeSelect = document.getElementById('accountType');
        const descInput = document.getElementById('accountDesc');
        if (nameInput) nameInput.value = '';
        if (amountInput) amountInput.value = '';
        if (typeSelect) typeSelect.value = '';
        if (descInput) descInput.value = '';
    }

    async function handleSaveAccount() {
        const name = (document.getElementById('accountName')?.value || '').trim();
        const amountValue = parseFloat(document.getElementById('accountAmount')?.value);
        const type = document.getElementById('accountType')?.value || 'other';
        const desc = (document.getElementById('accountDesc')?.value || '').trim();
        if (!name || isNaN(amountValue) || amountValue < 0) {
            alert('Введите корректные данные счета');
            return;
        }
        try {
            const response = await fetch('/api/accounts/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    name,
                    amount: amountValue,
                    account_type: type,
                    description: desc
                })
            });
            const data = await response.json();
            if (data.success && data.account) {
                await loadAccountsFromServer();
                closeModal('accountModal');
                resetAccountModal();
            } else {
                alert(data.error || 'Не удалось сохранить счет');
            }
        } catch (error) {
            console.error('Ошибка при сохранении счета:', error);
            alert('Не удалось сохранить счет. Попробуйте снова.');
        }
    }

    const addAccountBtn = document.getElementById('addAccountBtn');
    if (addAccountBtn) {
        addAccountBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetAccountModal();
            openModal('accountModal');
        });
    }

    const saveAccountBtn = document.getElementById('saveAccount');
    if (saveAccountBtn) {
        saveAccountBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleSaveAccount();
        });
    }

    const closeAccountBtn = document.getElementById('closeAccountModal');
    if (closeAccountBtn) {
        closeAccountBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeModal('accountModal');
        });
    }

    refreshFinancialOverview();
});