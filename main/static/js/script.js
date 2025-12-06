// === УТИЛИТЫ ===

function formatNumber(number) {
    return new Intl.NumberFormat('ru-RU').format(number)
}

function escapeHtml(str) {
    if (!str) return ''
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp','<':'&lt','>':'&gt','"':'&quot',"'":"&#39"})[s])
}

function adjustFontSize(element, text, type) {
    if (!element) return
    const length = text.length
    const baseSize = {small: 1, medium: 1.1, large: 1.2}
    const minSizes = {small: 0.45, medium: 0.85, large: 0.65}
    
    let fontSize = baseSize[type] * (length <= 8 ? 1 : Math.max(0.4, 1 - (length - 8) * 0.05))
    fontSize = Math.max(fontSize, minSizes[type])
    
    element.style.fontSize = fontSize + "em"
    element.style.whiteSpace = 'normal'
}

const accountTypeEmoji = {
    deposit: '🏦', debit: '💳', credit: '🧾', 
    savings: '🏖', investment: '📈', cash: '💵', other: '🏷️'
}

function getEmoji(category) {
    const map = {
        'еда': '🍔', 'транспорт': '🚌', 'развлечения': '🎮',
        'жилье': '🏠', 'здоровье': '💊', 'одежда': '👕',
        'другое': '💡', 'доход': '💰'
    }
    return map[category] || '💸'
}

function toggleAccountMenu() {
    const menu = document.getElementById('accountMenu')
    if (!menu) return
    menu.classList.toggle('active')
}

// === API ===

function getCookie(name) {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop().split(';').shift()
}

const csrftoken = getCookie('csrftoken')

async function apiFetch(path, method='GET', body=null) {
    const opts = {
        method,
        headers: {'Accept': 'application/json'},
        credentials: 'same-origin'
    }
    
    if (method !== 'GET' && method !== 'HEAD') {
        opts.headers['Content-Type'] = 'application/json'
        if (csrftoken) opts.headers['X-CSRFToken'] = csrftoken
        opts.body = body ? JSON.stringify(body) : null
    }
    
    const resp = await fetch(path, opts)
    
    if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`API ${method} ${path} failed: ${resp.status} ${text}`)
    }
    
    return resp.json()
}

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===

let income = 0, expenses = 0
let accounts = [], goals = [], incomeTransactions = [], expensesTransactions = []
let incomeExpenseChart, progressChart, viewGoalProgressChart
let editingAccountIndex = null, editingGoalIndex = null
let editingTransactionIndex = null, editingTransactionIsIncome = null
let viewingTransactionIndex = null, viewingTransactionIsIncome = null
let viewingAccountIndex = null, viewingGoalIndex = null

// === ЗАГРУЗКА ДАННЫХ ===

async function loadDataFromServer() {
    try {
        const [accountsRes, transactionsRes, goalsRes] = await Promise.all([
            apiFetch('/api/accounts/'),
            apiFetch('/api/transactions/'),
            apiFetch('/api/goals/')
        ])

        accounts = accountsRes.success ? accountsRes.accounts.map(a => ({
            id: a.id,
            name: a.name,
            amount: parseFloat(a.amount),
            type: a.account_type,
            desc: a.description || '',
            createdAt: a.created_at,
            updatedAt: a.updated_at
        })) : []

        const txs = transactionsRes.success ? transactionsRes.transactions : []
        incomeTransactions = txs.filter(t => t.transaction_type === 'income').map(t => ({
            id: t.id,
            name: t.name,
            amount: parseFloat(t.amount),
            category: t.category,
            date: t.date
        }))
        expensesTransactions = txs.filter(t => t.transaction_type === 'expense').map(t => ({
            id: t.id,
            name: t.name,
            amount: parseFloat(t.amount),
            category: t.category,
            date: t.date
        }))

        goals = goalsRes.success ? goalsRes.goals.map(g => ({
            id: g.id,
            name: g.name,
            targetAmount: parseFloat(g.target_amount),
            currentAmount: parseFloat(g.current_amount),
            createdAt: g.created_at,
            updatedAt: g.updated_at
        })) : []

        income = incomeTransactions.reduce((s, t) => s + (t.amount || 0), 0)
        expenses = expensesTransactions.reduce((s, t) => s + (t.amount || 0), 0)

        console.log('✅ Данные успешно загружены:', {
            accounts: accounts.length,
            income: incomeTransactions.length,
            expenses: expensesTransactions.length,
            goals: goals.length
        })
    } catch (err) {
        console.error('❌ Ошибка загрузки данных:', err)
        income = 0
        expenses = 0
        accounts = []
        goals = []
        incomeTransactions = []
        expensesTransactions = []
    }
}

// === МОДАЛЬНЫЕ ОКНА - УТИЛИТЫ ===

function closeModal(modalId) {
    const modal = document.getElementById(modalId)
    if (modal) modal.style.display = 'none'
}

function openModal(modalId) {
    const modal = document.getElementById(modalId)
    if (modal) modal.style.display = 'block'
}

// === ТРАНЗАКЦИИ ===

function addIncome() {
    const amount = parseFloat(document.getElementById('incomeAmount').value)
    const name = document.getElementById('incomeName')?.value.trim() || 'Доход'
    const date = document.getElementById('incomeDate')?.value
    const time = document.getElementById('incomeTime')?.value
    
    if (isNaN(amount) || amount <= 0) {
        alert("Введите корректную сумму")
        return
    }

    const dateTime = date && time ? new Date(`${date}T${time}`) : new Date()
    
    const transaction = {
        name,
        amount,
        transaction_type: 'income',
        category: 'доход',
        date: dateTime.toISOString()
    };

    (async () => {
        try {
            if (editingTransactionIndex !== null && editingTransactionIsIncome) {
                const existing = incomeTransactions[editingTransactionIndex]
                const res = await apiFetch(`/api/transactions/${existing.id}/`, 'PUT', transaction)
                
                if (res.success && res.transaction) {
                    incomeTransactions[editingTransactionIndex] = {
                        id: res.transaction.id,
                        name: res.transaction.name,
                        amount: parseFloat(res.transaction.amount),
                        category: res.transaction.category,
                        date: res.transaction.date
                    }
                }
            } else {
                const res = await apiFetch('/api/transactions/', 'POST', transaction)
                
                if (res.success && res.transaction) {
                    incomeTransactions.push({
                        id: res.transaction.id,
                        name: res.transaction.name,
                        amount: parseFloat(res.transaction.amount),
                        category: res.transaction.category,
                        date: res.transaction.date
                    })
                }
            }

            income = incomeTransactions.reduce((s, t) => s + (t.amount || 0), 0)
            
            updateBalance()
            updateEconomy()
            renderTransactionsList()
            
            closeModal('incomeModal')
            resetIncomeModal()
            editingTransactionIndex = null
            editingTransactionIsIncome = null
            
            const currentPeriod = document.querySelector('.dashboard .period-btn.period-active')?.dataset.period || 'month'
            updateChart(currentPeriod)
            
            console.log('✅ Доход сохранен')
        } catch (err) {
            console.error('❌ Ошибка сохранения дохода:', err)
            alert('Не удалось сохранить доход. Проверьте соединение и повторите попытку.')
        }
    })()
}

function addExpense() {
    let amount = parseFloat(document.getElementById('expensesAmount').value.trim().replace(',', '.'))
    const name = document.getElementById('expensesName').value.trim()
    const category = document.getElementById('expensesCategory').value.trim()
    const date = document.getElementById('expensesDate').value
    const time = document.getElementById('expensesTime').value
    
    if (isNaN(amount) || amount <= 0 || !category || !name) {
        alert("Заполните все поля корректно")
        return
    }

    amount = Math.abs(amount)
    const dateTime = date && time ? new Date(`${date}T${time}`) : new Date()
    
    const transaction = {
        name,
        amount,
        transaction_type: 'expense',
        category,
        date: dateTime.toISOString()
    };

    (async () => {
        try {
            if (editingTransactionIndex !== null && !editingTransactionIsIncome) {
                const existing = expensesTransactions[editingTransactionIndex]
                const res = await apiFetch(`/api/transactions/${existing.id}/`, 'PUT', transaction)
                
                if (res.success && res.transaction) {
                    expensesTransactions[editingTransactionIndex] = {
                        id: res.transaction.id,
                        name: res.transaction.name,
                        amount: parseFloat(res.transaction.amount),
                        category: res.transaction.category,
                        date: res.transaction.date
                    }
                }
            } else {
                const res = await apiFetch('/api/transactions/', 'POST', transaction)
                
                if (res.success && res.transaction) {
                    expensesTransactions.push({
                        id: res.transaction.id,
                        name: res.transaction.name,
                        amount: parseFloat(res.transaction.amount),
                        category: res.transaction.category,
                        date: res.transaction.date
                    })
                }
            }

            expenses = expensesTransactions.reduce((s, t) => s + (t.amount || 0), 0)
            
            updateBalance()
            updateEconomy()
            renderTransactionsList()
            
            closeModal('expensesModal')
            resetExpensesModal()
            editingTransactionIndex = null
            editingTransactionIsIncome = null
            
            const currentPeriod = document.querySelector('.dashboard .period-btn.period-active')?.dataset.period || 'month'
            updateChart(currentPeriod)
            
            console.log('✅ Расход сохранен')
        } catch (err) {
            console.error('❌ Ошибка сохранения расхода:', err)
            alert('Не удалось сохранить расход. Проверьте соединение и повторите попытку.')
        }
    })()
}

// === СЧЕТА ===

function saveAccountFromModal() {
    const name = document.getElementById('accountName')?.value.trim()
    let amount = parseFloat(String(document.getElementById('accountAmount')?.value).replace(',', '.'))
    const type = document.getElementById('accountType')?.value || 'other'
    const desc = document.getElementById('accountDesc')?.value.trim() || ''

    if (!name) {
        alert('Введите название счета')
        return
    }
    if (isNaN(amount) || amount < 0) {
        alert('Введите корректную сумму')
        return
    }

    (async () => {
        try {
            if (editingAccountIndex === null) {
                const res = await apiFetch('/api/accounts/', 'POST', {
                    name, amount, account_type: type, description: desc
                })
                
                if (res.success && res.account) {
                    accounts.push({
                        id: res.account.id,
                        name: res.account.name,
                        amount: parseFloat(res.account.amount),
                        type: res.account.account_type,
                        desc: res.account.description || '',
                        createdAt: res.account.created_at,
                        updatedAt: res.account.updated_at
                    })
                }
            } else {
                const acc = accounts[editingAccountIndex]
                const res = await apiFetch(`/api/accounts/${acc.id}/`, 'PUT', {
                    name, amount, account_type: type, description: desc
                })
                
                if (res.success && res.account) {
                    acc.name = res.account.name
                    acc.amount = parseFloat(res.account.amount)
                    acc.type = res.account.account_type
                    acc.desc = res.account.description || ''
                    acc.updatedAt = res.account.updated_at
                }
            }
            
            renderAccounts()
            closeModal('accountModal')
            console.log('✅ Счет сохранен')
        } catch (err) {
            console.error('❌ Ошибка сохранения счета:', err)
            alert('Не удалось сохранить счет. Проверьте соединение и повторите попытку.')
        }
    })()
}

function deleteAccountFromModal() {
    if (editingAccountIndex === null) return
    if (!confirm('Удалить этот счет?')) return
    
    (async () => {
        try {
            const acc = accounts[editingAccountIndex]
            await apiFetch(`/api/accounts/${acc.id}/`, 'DELETE')
            
            accounts.splice(editingAccountIndex, 1)
            renderAccounts()
            closeModal('accountModal')
            console.log('✅ Счет удален')
        } catch (err) {
            console.error('❌ Ошибка удаления счета:', err)
            alert('Не удалось удалить счет. Попробуйте снова.')
        }
    })()
}

function openAccountModalForNew() {
    editingAccountIndex = null
    document.getElementById('accountName').value = ''
    document.getElementById('accountAmount').value = ''
    document.getElementById('accountType').value = ''
    document.getElementById('accountDesc').value = ''
    document.getElementById('accountModalTitle').textContent = 'Добавить счет'
    document.getElementById('deleteAccount').style.display = 'none'
    openModal('accountModal')
}

function openAccountModalForEdit(index) {
    const acc = accounts[index]
    if (!acc) return
    
    editingAccountIndex = index
    document.getElementById('accountName').value = acc.name || ''
    document.getElementById('accountAmount').value = acc.amount || 0
    document.getElementById('accountType').value = acc.type || ''
    document.getElementById('accountDesc').value = acc.desc || ''
    document.getElementById('accountModalTitle').textContent = 'Редактировать счет'
    document.getElementById('deleteAccount').style.display = 'inline-block'
    openModal('accountModal')
}

// === ЦЕЛИ ===

function saveGoalFromModal() {
    const name = document.getElementById('goalName')?.value.trim()
    const targetAmount = parseFloat(document.getElementById('goalTarget')?.value)
    const currentAmount = parseFloat(document.getElementById('goalCurrent')?.value)
    
    if (!name) {
        alert('Введите название цели')
        return
    }
    if (isNaN(targetAmount) || targetAmount <= 0) {
        alert('Введите корректную целевую сумму')
        return
    }
    if (isNaN(currentAmount) || currentAmount < 0) {
        alert('Текущая сумма не может быть отрицательной')
        return
    }

    (async () => {
        try {
            if (editingGoalIndex === null) {
                const res = await apiFetch('/api/goals/', 'POST', {
                    name, target_amount: targetAmount, current_amount: currentAmount
                })
                
                if (res.success && res.goal) {
                    goals.push({
                        id: res.goal.id,
                        name: res.goal.name,
                        targetAmount: parseFloat(res.goal.target_amount),
                        currentAmount: parseFloat(res.goal.current_amount),
                        createdAt: res.goal.created_at,
                        updatedAt: res.goal.updated_at
                    })
                }
            } else {
                const goal = goals[editingGoalIndex]
                const res = await apiFetch(`/api/goals/${goal.id}/`, 'PUT', {
                    name, target_amount: targetAmount, current_amount: currentAmount
                })
                
                if (res.success && res.goal) {
                    goal.name = res.goal.name
                    goal.targetAmount = parseFloat(res.goal.target_amount)
                    goal.currentAmount = parseFloat(res.goal.current_amount)
                    goal.updatedAt = res.goal.updated_at
                }
            }
            
            renderGoals()
            closeModal('goalModal')
            console.log('✅ Цель сохранена')
        } catch (err) {
            console.error('❌ Ошибка сохранения цели:', err)
            alert('Не удалось сохранить цель. Проверьте соединение и повторите попытку.')
        }
    })()
}

function openGoalModalForNew() {
    editingGoalIndex = null
    document.getElementById('goalName').value = ''
    document.getElementById('goalTarget').value = ''
    document.getElementById('goalCurrent').value = '0'
    document.getElementById('goalModalTitle').textContent = 'Добавить цель'
    openModal('goalModal')
}

function openGoalModalForEdit(index) {
    const goal = goals[index]
    if (!goal) return

    editingGoalIndex = index
    document.getElementById('goalName').value = goal.name || ''
    document.getElementById('goalTarget').value = goal.targetAmount || 0
    document.getElementById('goalCurrent').value = goal.currentAmount || 0
    document.getElementById('goalModalTitle').textContent = 'Редактировать цель'
    openModal('goalModal')
}

// === ПРОСМОТР ===

function openTransactionView(index, isIncome) {
    const transactions = isIncome ? incomeTransactions : expensesTransactions
    const transaction = transactions[index]
    
    if (!transaction) return

    viewingTransactionIndex = index
    viewingTransactionIsIncome = isIncome

    const emoji = getEmoji(transaction.category)
    
    document.getElementById('viewTransactionEmoji').innerHTML = `<span class="emoji">${emoji}</span>`
    document.getElementById('viewTransactionName').textContent = (transaction.name || (isIncome ? 'Доход' : 'Трата')).toUpperCase()
    
    const amountText = formatNumber(transaction.amount) + '₽'
    const amountEl = document.getElementById('viewTransactionAmount')
    amountEl.textContent = isIncome ? '+' + amountText : '-' + amountText
    amountEl.className = `transaction-amount-large ${isIncome ? 'income' : 'expense'}`
    
    document.getElementById('viewTransactionCategory').textContent = transaction.category || 'Не указана'
    
    const transactionDate = new Date(transaction.date)
    document.getElementById('viewTransactionDate').textContent = transactionDate.toLocaleDateString('ru-RU')
    document.getElementById('viewTransactionTime').textContent = transactionDate.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    })
    document.getElementById('viewTransactionType').textContent = isIncome ? 'Доход' : 'Расход'

    openModal('viewTransactionModal')
}

function openAccountView(index) {
    const account = accounts[index]
    
    if (!account) return

    viewingAccountIndex = index

    const emoji = accountTypeEmoji[account.type] || accountTypeEmoji.other
    
    document.getElementById('viewAccountEmoji').innerHTML = `<span class="emoji">${emoji}</span>`
    document.getElementById('viewAccountName').textContent = (account.name || 'Не указано').toUpperCase()
    document.getElementById('viewAccountAmount').textContent = formatNumber(account.amount) + '₽'
    
    const typeNames = {
        deposit: 'Вклад',
        debit: 'Дебетовый счет',
        credit: 'Кредитный счет',
        savings: 'Накопительный счет',
        investment: 'Инвестиционный счет',
        cash: 'Наличные',
        other: 'Другое'
    }
    document.getElementById('viewAccountType').textContent = typeNames[account.type] || 'Не указан'
    document.getElementById('viewAccountDesc').textContent = account.desc || 'Не указано'
    
    const createdDate = account.createdAt ? new Date(account.createdAt) : new Date()
    document.getElementById('viewAccountCreated').textContent = createdDate.toLocaleDateString('ru-RU')

    openModal('viewAccountModal')
}

function openGoalView(index) {
    const goal = goals[index]
    
    if (!goal) return

    viewingGoalIndex = index
    
    document.getElementById('viewGoalName').textContent = (goal.name || 'Не указано').toUpperCase()
    document.getElementById('viewGoalTarget').textContent = formatNumber(goal.targetAmount) + '₽'
    document.getElementById('viewGoalCurrent').textContent = formatNumber(goal.currentAmount) + '₽'
    
    const progress = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)
    document.getElementById('viewGoalProgress').textContent = progress + '%'
    document.getElementById('viewGoalAmounts').textContent = `${formatNumber(goal.currentAmount)} / ${formatNumber(goal.targetAmount)}`
    document.getElementById('viewGoalProgressText').textContent = progress + '%'

    createViewGoalProgressChart(progress)

    openModal('viewGoalModal')
}

function createViewGoalProgressChart(progress) {
    const ctx = document.getElementById('viewGoalProgressChart')
    if (!ctx) return

    if (viewGoalProgressChart) {
        viewGoalProgressChart.destroy()
    }

    viewGoalProgressChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [progress, 100 - progress],
                backgroundColor: ['#FF5858', '#EFEFEF'],
                borderWidth: 0,
                cutout: '75%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    })
}

// === РЕНДЕРИНГ ===

function renderAccounts() {
    const accountsList = document.getElementById('accountsList')
    if (!accountsList) return
    
    accountsList.innerHTML = ''

    if (accounts.length === 0) {
        accountsList.innerHTML = '<div class="menu-account no-accounts"><div class="menu-account-info" style="padding:.6em; text-align:center; color:#666; width:100%;">Нет счетов</div></div>'
        return
    }

    accounts.forEach((acc, index) => {
        const accEl = document.createElement('div')
        accEl.className = 'menu-account'
        accEl.style.cursor = 'pointer'
        const emoji = accountTypeEmoji[acc.type] || accountTypeEmoji.other
        
        accEl.innerHTML = `
            <div class="menu-account-circle">
                <div class="menu-account-img"><span>${emoji}</span></div>
            </div>
            <div class="menu-account-info">
                <p class="account-name">${escapeHtml(acc.name)}</p>
                <p class="account-amount">${formatNumber(acc.amount)}₽</p>
            </div>
        `
        
        accEl.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            openAccountView(index)
        })
        accountsList.appendChild(accEl)
    })
}

function renderGoals() {
    const goalsList = document.getElementById('goalsList')
    if (!goalsList) return

    goalsList.innerHTML = ''

    if (goals.length === 0) {
        goalsList.innerHTML = '<div class="goal-item" style="text-align: center; padding: 1em; color: #666;">Нет активных целей</div>'
        return
    }

    goals.forEach((goal, index) => {
        const progress = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)

        const goalEl = document.createElement('div')
        goalEl.className = 'goal-item'
        goalEl.style.cursor = 'pointer'
        goalEl.innerHTML = `
            <div class="goal-header">
                <div class="goal-title">${escapeHtml(goal.name)}</div>
                <div class="goal-percentage">${progress}%</div>
            </div>
            <div class="goal-progress">
                <canvas id="goalProgressChart-${index}"></canvas>
            </div>
            <div class="goal-amounts">
                <span>${formatNumber(goal.currentAmount)}₽</span>
                <span>${formatNumber(goal.targetAmount)}₽</span>
            </div>
        `

        goalEl.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            openGoalView(index)
        })
        goalsList.appendChild(goalEl)
        
        // Создаем график после добавления элемента в DOM
        setTimeout(() => {
            const canvas = document.getElementById(`goalProgressChart-${index}`)
            if (canvas) {
                new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: ['Прогресс'],
                        datasets: [{
                            data: [progress],
                            backgroundColor: '#FF5858',
                            borderRadius: 8
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: { min: 0, max: 100, display: false },
                            y: { display: false }
                        },
                        plugins: { legend: { display: false }, tooltip: { enabled: false } }
                    }
                })
            }
        }, 0)
    })
}

function renderTransactionsList() {
    const transactionsList = document.getElementById('transactionsList')
    if (!transactionsList) return
    
    transactionsList.innerHTML = ''

    const allTransactions = [
        ...incomeTransactions.map(t => ({ ...t, type: 'income' })),
        ...expensesTransactions.map(t => ({ ...t, type: 'expense' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date))

    if (allTransactions.length === 0) {
        transactionsList.innerHTML = '<div class="transaction-item"><p>Нет транзакций</p></div>'
        return
    }

    const groups = {}
    allTransactions.forEach(t => {
        const key = new Date(t.date).toDateString()
        if (!groups[key]) groups[key] = []
        groups[key].push(t)
    })

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).forEach(dateKey => {
        const date = new Date(dateKey)
        const dateLabel = date.toDateString() === today.toDateString() ? 'Сегодня' 
            : date.toDateString() === yesterday.toDateString() ? 'Вчера'
            : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

        const dateHeader = document.createElement('div')
        dateHeader.className = 'transaction-date-header'
        dateHeader.textContent = dateLabel
        transactionsList.appendChild(dateHeader)

        groups[dateKey].forEach(transaction => {
            const transactionItem = document.createElement('div')
            transactionItem.className = 'transaction-item'
            transactionItem.style.cursor = 'pointer'
            const emoji = getEmoji(transaction.category)
            const amountClass = transaction.type === 'income' ? 'positive' : 'negative'
            const amountSign = transaction.type === 'income' ? '+' : '-'
            const timeString = new Date(transaction.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

            transactionItem.innerHTML = `
                <div class="transaction-icon emoji-bg"><span class="emoji">${emoji}</span></div>
                <div class="transaction-info">
                    <p class="transaction-name">${escapeHtml(transaction.name)}</p>
                    <p class="transaction-category">${transaction.category} <span class="transaction-time" style="color:#999; font-size:0.8em; margin-left:6px">${timeString}</span></p>
                </div>
                <div class="transaction-amount ${amountClass}">
                    <p>${amountSign}${formatNumber(transaction.amount)}₽</p>
                </div>
            `

            transactionItem.addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                const isIncome = transaction.type === 'income'
                const sourceArray = isIncome ? incomeTransactions : expensesTransactions
                const index = sourceArray.findIndex(t => t.id === transaction.id)
                if (index !== -1) openTransactionView(index, isIncome)
            })
            
            transactionsList.appendChild(transactionItem)
        })
    })
}

function updateBalance() {
    const balanceText = document.getElementById('balanceText')
    if (balanceText) {
        const value = formatNumber(income - expenses) + "₽"
        balanceText.textContent = value
        adjustFontSize(balanceText, value, "large")
    }
}

function updateEconomy(period = 'month') {
    const filteredIncome = filterTransactions(incomeTransactions, period)
    const filteredExpenses = filterTransactions(expensesTransactions, period)

    const periodIncome = filteredIncome.reduce((sum, t) => sum + t.amount, 0)
    const periodExpenses = filteredExpenses.reduce((sum, t) => sum + t.amount, 0)
    const periodSavings = periodIncome - periodExpenses
    const periodPercent = periodIncome > 0 ? Math.round((periodSavings / periodIncome) * 100) : 0

    const incomeText = document.getElementById('incomeText')
    const expensesText = document.getElementById('expensesText')
    const savingsElement = document.getElementById('savingsText')
    const progressText = document.getElementById('progressText')

    if (incomeText) {
        const value = formatNumber(periodIncome) + '₽'
        incomeText.textContent = value
        adjustFontSize(incomeText, value, 'small')
    }

    if (expensesText) {
        const value = formatNumber(periodExpenses) + "₽"
        expensesText.textContent = value
        adjustFontSize(expensesText, value, "small")
    }

    if (savingsElement) {
        const value = formatNumber(periodSavings) + "₽"
        savingsElement.textContent = value
        adjustFontSize(savingsElement, value, "medium")
    }

    if (progressText) progressText.textContent = periodPercent + "%"

    if (progressChart) {
        progressChart.data.datasets[0].data[0] = periodPercent
        progressChart.update()
    }
}

// === СРЕДНИЕ ЗНАЧЕНИЯ ===
function updateAverages(period = 'month') {
    // Фильтруем транзакции по периоду
    const filteredIncome = filterTransactions(incomeTransactions, period)
    const filteredExpenses = filterTransactions(expensesTransactions, period)

    const totalIncome = filteredIncome.reduce((sum, t) => sum + (t.amount || 0), 0)
    const totalExpenses = filteredExpenses.reduce((sum, t) => sum + (t.amount || 0), 0)

    // Делитель — количество единиц времени в выбранном периоде
    let divisor = 1
    if (period === 'week') {
        divisor = 7
    } else if (period === 'month') {
        const now = new Date()
        divisor = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    } else if (period === 'year') {
        divisor = 12
    }

    const avgIncome = divisor ? totalIncome / divisor : 0
    const avgExpenses = divisor ? totalExpenses / divisor : 0

    const avgIncomeEl = document.getElementById('avgIncomeText')
    const avgExpensesEl = document.getElementById('avgExpensesText')

    if (avgIncomeEl) {
        avgIncomeEl.textContent = formatNumber(Math.round(avgIncome)) + '₽'
        adjustFontSize(avgIncomeEl, String(Math.round(avgIncome)), 'small')
    }

    if (avgExpensesEl) {
        avgExpensesEl.textContent = formatNumber(Math.round(avgExpenses)) + '₽'
        adjustFontSize(avgExpensesEl, String(Math.round(avgExpenses)), 'small')
    }
}

// === ДАТА/ФИЛЬТРЫ ===

function getDateRange(period) {
    const now = new Date()
    let startDate, endDate

    switch(period) {
        case 'week':
            startDate = new Date(now)
            startDate.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(startDate)
            endDate.setDate(startDate.getDate() + 6)
            endDate.setHours(23, 59, 59, 999)
            break
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
            break
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1)
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
            break
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    }
    
    return { startDate, endDate }
}

function filterTransactions(transactions, period) {
    const { startDate, endDate } = getDateRange(period)
    return transactions.filter(t => {
        const d = new Date(t.date)
        return d >= startDate && d <= endDate
    })
}

function updateChart(period) {
    if (!incomeExpenseChart) return
    
    const filteredIncome = filterTransactions(incomeTransactions, period)
    const filteredExpenses = filterTransactions(expensesTransactions, period)
    
    let labels = []
    let incomeData = []
    let expensesData = []
    
    if (period === 'week') {
        labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
        incomeData = new Array(7).fill(0)
        expensesData = new Array(7).fill(0)
        
        filteredIncome.forEach(t => {
            const day = (new Date(t.date).getDay() + 6) % 7
            incomeData[day] += t.amount
        })
        filteredExpenses.forEach(t => {
            const day = (new Date(t.date).getDay() + 6) % 7
            expensesData[day] += t.amount
        })
    } else if (period === 'month') {
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
        labels = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString())
        incomeData = new Array(daysInMonth).fill(0)
        expensesData = new Array(daysInMonth).fill(0)
        
        filteredIncome.forEach(t => {
            const day = new Date(t.date).getDate() - 1
            if (day >= 0 && day < daysInMonth) incomeData[day] += t.amount
        })
        filteredExpenses.forEach(t => {
            const day = new Date(t.date).getDate() - 1
            if (day >= 0 && day < daysInMonth) expensesData[day] += t.amount
        })
    } else {
        labels = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
        incomeData = new Array(12).fill(0)
        expensesData = new Array(12).fill(0)
        
        filteredIncome.forEach(t => {
            const month = new Date(t.date).getMonth()
            incomeData[month] += t.amount
        })
        filteredExpenses.forEach(t => {
            const month = new Date(t.date).getMonth()
            expensesData[month] += t.amount
        })
    }
    
    incomeExpenseChart.data.labels = labels
    incomeExpenseChart.data.datasets[0].data = incomeData
    incomeExpenseChart.data.datasets[1].data = expensesData
    incomeExpenseChart.update()
}

function updateContent(period, section = 'all') {
    if (section === 'economy' || section === 'all') updateEconomy(period)
    if (section === 'chart' || section === 'all') {
        updateChart(period)
        updateAverages(period)
    }
}

// === МОДАЛЬНЫЕ ОКНА - СБРОС ===

function resetIncomeModal() {
    document.getElementById('incomeAmount').value = ""
    document.getElementById('incomeName').value = ""
    const now = new Date()
    document.getElementById('incomeDate').valueAsDate = now
    document.getElementById('incomeTime').value = now.toTimeString().slice(0, 5)
}

function resetExpensesModal() {
    document.getElementById('expensesAmount').value = ""
    document.getElementById('expensesName').value = ""
    document.getElementById('expensesCategory').value = ""
    const now = new Date()
    document.getElementById('expensesDate').valueAsDate = now
    document.getElementById('expensesTime').value = now.toTimeString().slice(0, 5)
}

// === ДЕЙСТВИЯ ===

function clearSelectedData() {
    const clearTransactions = document.getElementById('clearTransactions')?.checked
    const clearAccounts = document.getElementById('clearAccounts')?.checked
    const clearGoals = document.getElementById('clearGoals')?.checked
    const clearAll = document.getElementById('clearAll')?.checked
    
    let message = "Вы уверены, что хотите удалить"
    let items = []
    
    if (clearAll) {
        message += " ВСЕ данные? Это действие нельзя отменить."
    } else {
        if (clearTransactions) items.push("транзакции")
        if (clearAccounts) items.push("счета")
        if (clearGoals) items.push("цели")
        
        if (items.length === 0) {
            alert("Выберите данные для удаления")
            return
        }
        
        message += " " + items.join(", ") + "?"
    }
    
    if (!confirm(message)) return
    
    (async () => {
        try {
            if (clearAll || clearTransactions) {
                for (const tx of [...incomeTransactions]) {
                    if (tx.id) await apiFetch(`/api/transactions/${tx.id}/`, 'DELETE')
                }
                for (const tx of [...expensesTransactions]) {
                    if (tx.id) await apiFetch(`/api/transactions/${tx.id}/`, 'DELETE')
                }
                income = 0
                expenses = 0
                incomeTransactions = []
                expensesTransactions = []
            }

            if (clearAll || clearAccounts) {
                for (const acc of [...accounts]) {
                    if (acc.id) await apiFetch(`/api/accounts/${acc.id}/`, 'DELETE')
                }
                accounts = []
            }

            if (clearAll || clearGoals) {
                for (const g of [...goals]) {
                    if (g.id) await apiFetch(`/api/goals/${g.id}/`, 'DELETE')
                }
                goals = []
            }

            updateBalance()
            updateEconomy()
            renderTransactionsList()
            renderAccounts()
            renderGoals()

            const activeBtn = document.querySelector('.dashboard .period-btn.period-active')
            const currentPeriod = activeBtn ? activeBtn.getAttribute('data-period') : 'month'
            updateChart(currentPeriod)

            closeModal('clearDataModal')
            alert("Данные успешно удалены")
            console.log('✅ Данные очищены')
        } catch (err) {
            console.error('❌ Ошибка при удалении данных:', err)
            alert('Не удалось удалить данные. Попробуйте снова.')
        }
    })()
}

function exportAllData() {
    try {
        const data = {
            income: income,
            expenses: expenses,
            accounts: accounts,
            goals: goals,
            incomeTransactions: incomeTransactions,
            expensesTransactions: expensesTransactions,
            exportDate: new Date().toISOString(),
            app: "CtrlMoney"
        }
        
        const dataStr = JSON.stringify(data, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        
        const link = document.createElement('a')
        link.href = URL.createObjectURL(dataBlob)
        link.download = `CtrlMoney_backup_${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        alert("Данные успешно экспортированы в файл")
        console.log('✅ Данные экспортированы')
    } catch (error) {
        console.error("❌ Ошибка при экспорте данных:", error)
        alert("Произошла ошибка при экспорте данных")
    }
}

// === ОБРАБОТЧИКИ ПРОСМОТРА ===

function setupViewModalHandlers() {
    // Редактирование транзакции
    const editTransactionBtn = document.getElementById('editViewTransaction')
    if (editTransactionBtn) {
        editTransactionBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('viewTransactionModal')
            
            if (viewingTransactionIsIncome) {
                editingTransactionIndex = viewingTransactionIndex
                editingTransactionIsIncome = true
                
                resetIncomeModal()
                document.getElementById('incomeName').value = incomeTransactions[viewingTransactionIndex].name || ''
                document.getElementById('incomeAmount').value = incomeTransactions[viewingTransactionIndex].amount || ''
                
                const date = new Date(incomeTransactions[viewingTransactionIndex].date)
                document.getElementById('incomeDate').valueAsDate = date
                document.getElementById('incomeTime').value = date.toTimeString().slice(0, 5)
                
                document.querySelector('#incomeModal h2').textContent = 'Редактировать доход'
                openModal('incomeModal')
            } else {
                editingTransactionIndex = viewingTransactionIndex
                editingTransactionIsIncome = false
                
                resetExpensesModal()
                document.getElementById('expensesName').value = expensesTransactions[viewingTransactionIndex].name || ''
                document.getElementById('expensesAmount').value = expensesTransactions[viewingTransactionIndex].amount || ''
                document.getElementById('expensesCategory').value = expensesTransactions[viewingTransactionIndex].category || ''
                
                const date = new Date(expensesTransactions[viewingTransactionIndex].date)
                document.getElementById('expensesDate').valueAsDate = date
                document.getElementById('expensesTime').value = date.toTimeString().slice(0, 5)
                
                document.querySelector('#expensesModal h2').textContent = 'Редактировать трату'
                openModal('expensesModal')
            }
        }
    }

    // Удаление транзакции
    const deleteTransactionBtn = document.getElementById('deleteViewTransaction')
    if (deleteTransactionBtn) {
        deleteTransactionBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            if (!confirm('Удалить эту транзакцию?')) return
            
            (async () => {
                try {
                    const transactions = viewingTransactionIsIncome ? incomeTransactions : expensesTransactions
                    const tx = transactions[viewingTransactionIndex]

                    if (tx && tx.id) {
                        await apiFetch(`/api/transactions/${tx.id}/`, 'DELETE')
                    }

                    transactions.splice(viewingTransactionIndex, 1)
                    income = incomeTransactions.reduce((s, t) => s + (t.amount || 0), 0)
                    expenses = expensesTransactions.reduce((s, t) => s + (t.amount || 0), 0)

                    updateBalance()
                    updateEconomy()
                    renderTransactionsList()
                    closeModal('viewTransactionModal')

                    const activeBtn = document.querySelector('.dashboard .period-btn.period-active')
                    const currentPeriod = activeBtn ? activeBtn.getAttribute('data-period') : 'month'
                    updateChart(currentPeriod)
                    
                    console.log('✅ Транзакция удалена')
                } catch (err) {
                    console.error('❌ Ошибка удаления транзакции:', err)
                    alert('Не удалось удалить транзакцию. Попробуйте снова.')
                }
            })()
        }
    }

    // Редактирование счета
    const editAccountBtn = document.getElementById('editViewAccount')
    if (editAccountBtn) {
        editAccountBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('viewAccountModal')
            openAccountModalForEdit(viewingAccountIndex)
        }
    }

    // Удаление счета
    const deleteAccountBtn = document.getElementById('deleteViewAccount')
    if (deleteAccountBtn) {
        deleteAccountBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('viewAccountModal')
            editingAccountIndex = viewingAccountIndex
            deleteAccountFromModal()
        }
    }

    // Редактирование цели
    const editGoalBtn = document.getElementById('editViewGoal')
    if (editGoalBtn) {
        editGoalBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('viewGoalModal')
            openGoalModalForEdit(viewingGoalIndex)
        }
    }

    // Удаление цели
    const deleteGoalBtn = document.getElementById('deleteViewGoal')
    if (deleteGoalBtn) {
        deleteGoalBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            if (!confirm('Удалить эту цель?')) return
            
            (async () => {
                try {
                    const goal = goals[viewingGoalIndex]
                    if (goal && goal.id) {
                        await apiFetch(`/api/goals/${goal.id}/`, 'DELETE')
                    }
                    goals.splice(viewingGoalIndex, 1)
                    renderGoals()
                    closeModal('viewGoalModal')
                    console.log('✅ Цель удалена')
                } catch (err) {
                    console.error('❌ Ошибка удаления цели:', err)
                    alert('Не удалось удалить цель. Попробуйте снова.')
                }
            })()
        }
    }
}

// === JSON IMPORT/EXPORT ФУНКЦИИ ===

async function importJsonDataFromFile() {
    const fileInput = document.getElementById('importJsonFile')
    const file = fileInput.files[0]
    
    if (!file) {
        alert('Пожалуйста, выберите JSON файл')
        return
    }
    
    if (!file.name.endsWith('.json')) {
        alert('Пожалуйста, выберите файл с расширением .json')
        return
    }
    
    const formData = new FormData()
    formData.append('json_file', file)
    
    const resultDiv = document.getElementById('importJsonResult')
    resultDiv.style.display = 'block'
    resultDiv.innerHTML = '<p style="color: #417690;">⏳ Загрузка файла...</p>'
    
    try {
        // Получаем CSRF токен
        const csrfValue = getCookie('csrftoken')
        
        const response = await fetch('/api/import-json/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': csrfValue
            },
            credentials: 'same-origin'
        })
        
        const data = await response.json()
        
        if (data.success) {
            let html = '<div style="background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 4px;">'
            html += '<p><strong>✅ Данные успешно загружены!</strong></p>'
            html += '<ul style="margin: 10px 0; padding-left: 20px;">'
            
            if (data.results.accounts.created > 0) {
                html += `<li>Счетов добавлено: ${data.results.accounts.created}</li>`
            }
            if (data.results.transactions.created > 0) {
                html += `<li>Транзакций добавлено: ${data.results.transactions.created}</li>`
            }
            if (data.results.goals.created > 0) {
                html += `<li>Целей добавлено: ${data.results.goals.created}</li>`
            }
            if (data.results.budget_categories.created > 0) {
                html += `<li>Категорий бюджета добавлено: ${data.results.budget_categories.created}</li>`
            }
            
            html += '</ul>'
            
            // Показать ошибки если они есть
            let hasErrors = false
            const errorSections = ['accounts', 'transactions', 'goals', 'budget_categories']
            errorSections.forEach(section => {
                if (data.results[section].errors.length > 0) {
                    hasErrors = true
                    html += `<p><strong>Ошибки при импорте ${section}:</strong></p><ul style="padding-left: 20px;">`
                    data.results[section].errors.forEach(err => {
                        html += `<li style="color: #721c24; font-size: 12px;">${err}</li>`
                    })
                    html += '</ul>'
                }
            })
            
            html += '</div>'
            resultDiv.innerHTML = html
            fileInput.value = ''
            
            // Перезагрузить данные
            setTimeout(() => {
                loadDataFromServer()
                renderAccounts()
                renderGoals()
                renderTransactionsList()
                updateBalance()
            }, 1000)
        } else {
            resultDiv.innerHTML = `<div style="background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 4px;">
                <p><strong>❌ Ошибка загрузки:</strong></p>
                <p>${data.error}</p>
            </div>`
        }
    } catch (error) {
        resultDiv.innerHTML = `<div style="background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 4px;">
            <p><strong>❌ Ошибка:</strong></p>
            <p>${error.message}</p>
        </div>`
    }
}

async function exportJsonData() {
    try {
        const response = await fetch('/api/export-json/', {
            method: 'GET',
            headers: {'Accept': 'application/json'},
            credentials: 'same-origin'
        })
        
        if (!response.ok) throw new Error('Ошибка экспорта')
        
        const data = await response.json()
        
        const jsonString = JSON.stringify(data, null, 2)
        const blob = new Blob([jsonString], {type: 'application/json; charset=utf-8'})
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        
        const now = new Date()
        const timestamp = now.toISOString().split('T')[0]
        link.download = `ctrlmoney_export_${timestamp}.json`
        
        link.click()
        URL.revokeObjectURL(link.href)
    } catch (error) {
        alert('Ошибка при экспорте: ' + error.message)
    }
}

// === ИНИЦИАЛИЗАЦИЯ ===

async function initApp() {
    console.log('🚀 Инициализация приложения...')
    
    await loadDataFromServer()
    
    // Инициализация графиков
    const ctx = document.getElementById('incomeExpenseChart')?.getContext('2d')
    const ctxProgress = document.getElementById('progressBar')?.getContext('2d')
    
    if (ctx) {
        incomeExpenseChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'],
                datasets: [
                    { label: 'Доход', data: [0,0,0,0,0,0,0,0,0,0,0,0], borderColor: '#FF8A5C', tension:0.4 },
                    { label: 'Траты', data: [0,0,0,0,0,0,0,0,0,0,0,0], borderColor:'#FF5858', tension:0.4 }
                ]
            },
            options: {
                responsive:true,
                maintainAspectRatio:false,
                plugins:{ legend:{ display:true, position: 'bottom' } },
                scales:{
                    x:{ grid:{ display:false }, border:{ display:false } },
                    y:{ display:false, grid:{ display:false } }
                }
            }
        })
    }

    if (ctxProgress) {
        progressChart = new Chart(ctxProgress, {
            type:'bar',
            data:{ labels:['Прогресс'], datasets:[{ label:'Прогресс', data:[0], backgroundColor:'#FF5858', borderRadius:8, stack:'base' }] },
            options:{ indexAxis:'y', scales:{ x:{ min:0, max:100, display:false }, y:{ display:false } }, plugins:{ legend:{ display:false }, tooltip:{ enabled:false } }, responsive:true, maintainAspectRatio:false }
        })
    }
    
    // Начальный рендеринг
    updateBalance()
    renderAccounts()
    renderGoals()
    renderTransactionsList()
    updateContent('month', 'all')
    
    // === ОБРАБОТЧИКИ СОБЫТИЙ ===
    
    // Доход
    const incomeBtn = document.getElementById('incomeBtn')
    if (incomeBtn) {
        incomeBtn.onclick = function(e) {
            e.preventDefault()
            editingTransactionIndex = null
            editingTransactionIsIncome = null
            resetIncomeModal()
            document.querySelector('#incomeModal h2').textContent = 'Добавить доход'
            openModal('incomeModal')
        }
    }
    
    const closeIncomeBtn = document.getElementById('closeIncomeModal')
    if (closeIncomeBtn) {
        closeIncomeBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('incomeModal')
        }
    }
    
    const addIncomeBtn = document.getElementById('addIncome')
    if (addIncomeBtn) {
        addIncomeBtn.onclick = function(e) {
            e.preventDefault()
            addIncome()
        }
    }
    
    // Расход
    const expensesBtn = document.getElementById('expensesBtn')
    if (expensesBtn) {
        expensesBtn.onclick = function(e) {
            e.preventDefault()
            editingTransactionIndex = null
            editingTransactionIsIncome = null
            resetExpensesModal()
            document.querySelector('#expensesModal h2').textContent = 'Добавить трату'
            openModal('expensesModal')
        }
    }
    
    const closeExpensesBtn = document.getElementById('closeExpensesModal')
    if (closeExpensesBtn) {
        closeExpensesBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('expensesModal')
        }
    }
    
    const addExpensesBtn = document.getElementById('addExpenses')
    if (addExpensesBtn) {
        addExpensesBtn.onclick = function(e) {
            e.preventDefault()
            addExpense()
        }
    }
    
    // Счета
    const addAccountBtn = document.getElementById('addAccountBtn')
    if (addAccountBtn) {
        addAccountBtn.onclick = function(e) {
            e.preventDefault()
            openAccountModalForNew()
        }
    }
    
    const saveAccountBtn = document.getElementById('saveAccount')
    if (saveAccountBtn) {
        saveAccountBtn.onclick = function(e) {
            e.preventDefault()
            saveAccountFromModal()
        }
    }
    
    const deleteAccountBtn = document.getElementById('deleteAccount')
    if (deleteAccountBtn) {
        deleteAccountBtn.onclick = function(e) {
            e.preventDefault()
            deleteAccountFromModal()
        }
    }
    
    const closeAccountBtn = document.getElementById('closeAccountModal')
    if (closeAccountBtn) {
        closeAccountBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('accountModal')
        }
    }
    
    // Цели
    const goalMenuBtn = document.querySelector('.menu-btn-target button')
    if (goalMenuBtn) {
        goalMenuBtn.onclick = function(e) {
            e.preventDefault()
            openGoalModalForNew()
        }
    }
    
    const saveGoalBtn = document.getElementById('saveGoal')
    if (saveGoalBtn) {
        saveGoalBtn.onclick = function(e) {
            e.preventDefault()
            saveGoalFromModal()
        }
    }
    
    const closeGoalBtn = document.getElementById('closeGoalModal')
    if (closeGoalBtn) {
        closeGoalBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('goalModal')
        }
    }

    // Модальные окна просмотра
    const closeViewTransactionBtn = document.getElementById('closeViewTransactionModal')
    if (closeViewTransactionBtn) {
        closeViewTransactionBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('viewTransactionModal')
        }
    }
    
    const closeViewAccountBtn = document.getElementById('closeViewAccountModal')
    if (closeViewAccountBtn) {
        closeViewAccountBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('viewAccountModal')
        }
    }
    
    const closeViewGoalBtn = document.getElementById('closeViewGoalModal')
    if (closeViewGoalBtn) {
        closeViewGoalBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('viewGoalModal')
        }
    }
    
    setupViewModalHandlers()

    // Actions
    const actionsBtn = document.querySelector('.menu-btn-actions button')
    if (actionsBtn) {
        actionsBtn.onclick = function(e) {
            e.preventDefault()
            openModal('actionsModal')
        }
    }
    
    const closeActionsBtn = document.getElementById('closeActionsModal')
    if (closeActionsBtn) {
        closeActionsBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('actionsModal')
        }
    }

    const clearDataActionBtn = document.getElementById('clearDataAction')
    if (clearDataActionBtn) {
        clearDataActionBtn.onclick = function(e) {
            e.preventDefault()
            closeModal('actionsModal')
            
            const clearTransactions = document.getElementById('clearTransactions')
            const clearAccounts = document.getElementById('clearAccounts')
            const clearGoals = document.getElementById('clearGoals')
            const clearAll = document.getElementById('clearAll')
            
            if (clearTransactions) {
                clearTransactions.checked = true
                clearTransactions.disabled = false
            }
            if (clearAccounts) {
                clearAccounts.checked = false
                clearAccounts.disabled = false
            }
            if (clearGoals) {
                clearGoals.checked = false
                clearGoals.disabled = false
            }
            if (clearAll) clearAll.checked = false
            
            openModal('clearDataModal')
        }
    }
    
    const closeClearDataBtn = document.getElementById('closeClearDataModal')
    if (closeClearDataBtn) {
        closeClearDataBtn.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('clearDataModal')
        }
    }
    
    const clearSelectedBtn = document.getElementById('clearSelectedData')
    if (clearSelectedBtn) {
        clearSelectedBtn.onclick = function(e) {
            e.preventDefault()
            clearSelectedData()
        }
    }
    
    const exportDataBtn = document.getElementById('exportDataAction')
    if (exportDataBtn) {
        exportDataBtn.onclick = function(e) {
            e.preventDefault()
            closeModal('actionsModal')
            exportAllData()
        }
    }

    // === JSON IMPORT/EXPORT ===
    
    const importJsonBtn = document.getElementById('importJsonAction')
    if (importJsonBtn) {
        importJsonBtn.onclick = function(e) {
            e.preventDefault()
            closeModal('actionsModal')
            openModal('importJsonModal')
        }
    }

    const exportJsonBtn = document.getElementById('exportJsonAction')
    if (exportJsonBtn) {
        exportJsonBtn.onclick = function(e) {
            e.preventDefault()
            closeModal('actionsModal')
            exportJsonData()
        }
    }

    const closeImportJsonModal = document.getElementById('closeImportJsonModal')
    if (closeImportJsonModal) {
        closeImportJsonModal.onclick = function(e) {
            e.preventDefault()
            e.stopPropagation()
            closeModal('importJsonModal')
        }
    }

    const importJsonFileBtn = document.getElementById('importJsonBtn')
    if (importJsonFileBtn) {
        importJsonFileBtn.onclick = function(e) {
            e.preventDefault()
            importJsonDataFromFile()
        }
    }
    
    // Логика чекбоксов
    const clearAllCheckbox = document.getElementById('clearAll')
    const clearTransactionsCheckbox = document.getElementById('clearTransactions')
    const clearAccountsCheckbox = document.getElementById('clearAccounts')
    const clearGoalsCheckbox = document.getElementById('clearGoals')
    
    if (clearAllCheckbox) {
        clearAllCheckbox.onchange = function() {
            if (this.checked) {
                if (clearTransactionsCheckbox) clearTransactionsCheckbox.checked = true
                if (clearAccountsCheckbox) clearAccountsCheckbox.checked = true
                if (clearGoalsCheckbox) clearGoalsCheckbox.checked = true
                
                ;[clearTransactionsCheckbox, clearAccountsCheckbox, clearGoalsCheckbox].forEach(cb => {
                    if (cb) cb.disabled = true
                })
            } else {
                ;[clearTransactionsCheckbox, clearAccountsCheckbox, clearGoalsCheckbox].forEach(cb => {
                    if (cb) cb.disabled = false
                })
            }
        }
    }
    
    ;[clearTransactionsCheckbox, clearAccountsCheckbox, clearGoalsCheckbox].forEach(checkbox => {
        if (checkbox) {
            checkbox.onchange = function() {
                if (!this.checked && clearAllCheckbox) {
                    clearAllCheckbox.checked = false
                }
            }
        }
    })

    // Закрытие модалок по клику на фон
    window.addEventListener('click', (e) => {
        const modals = ['incomeModal', 'expensesModal', 'accountModal', 'goalModal', 
                       'viewTransactionModal', 'viewAccountModal', 'viewGoalModal',
                       'actionsModal', 'clearDataModal', 'importJsonModal']
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId)
            if (modal && e.target === modal) {
                closeModal(modalId)
            }
        })
    })
    
    // Переключение периодов
    document.querySelectorAll('.economy .period-btn').forEach(button => {
        button.onclick = function() {
            document.querySelectorAll('.economy .period-btn').forEach(btn => btn.classList.remove('period-active'))
            this.classList.add('period-active')
            updateContent(this.getAttribute('data-period'), 'economy')
        }
    })
    
    document.querySelectorAll('.dashboard .period-btn').forEach(button => {
        button.onclick = function() {
            document.querySelectorAll('.dashboard .period-btn').forEach(btn => btn.classList.remove('period-active'))
            this.classList.add('period-active')
            updateContent(this.getAttribute('data-period'), 'chart')
        }
    })
    
    console.log('✅ Приложение успешно инициализировано')
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp)
} else {
    initApp()
}