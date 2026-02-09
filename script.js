// 구독 서비스 관리자 JavaScript

class SubscriptionManager {
    constructor() {
        this.subscriptions = this.loadFromStorage();
        this.currentEditId = null;
        this.exchangeRate = this.loadExchangeRate() || 1423.50; // USD -> KRW 환율 (기본값)
        this.exchangeRateUpdatedAt = this.loadExchangeRateUpdatedAt();
        this.currentTab = 'all'; // 현재 활성 탭
        this.init();
    }

    init() {
        this.bindEvents();
        this.render();
        this.updateStats();
        this.updateExchangeRate();
        this.startExchangeRatePolling();
        this.checkForUpdates();
    }

    bindEvents() {
        // 모달 관련 이벤트
        document.getElementById('addServiceBtn').addEventListener('click', () => this.openModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        
        // 폼 제출 이벤트
        document.getElementById('serviceForm').addEventListener('submit', (e) => this.handleSubmit(e));
        
        // 필터링 이벤트
        document.getElementById('categoryFilter').addEventListener('change', () => this.filterServices());
        document.getElementById('searchInput').addEventListener('input', () => this.filterServices());
        
        // 탭 이벤트
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // 모달 외부 클릭으로 닫기
        document.getElementById('serviceModal').addEventListener('click', (e) => {
            if (e.target.id === 'serviceModal') {
                this.closeModal();
            }
        });
        
        // 날짜 유효성 검사 이벤트
        document.getElementById('serviceStartDate').addEventListener('change', () => this.validateDates());
        document.getElementById('serviceEndDate').addEventListener('change', () => this.validateDates());
        
        // 데이터 내보내기/가져오기 이벤트
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => this.triggerImport());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));

        // 상세 토글 이벤트 (서비스 카드)
        document.getElementById('servicesGrid').addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.details-toggle');
            if (!toggleBtn) return;
            const card = toggleBtn.closest('.service-card');
            const details = card.querySelector('.service-details-collapsible');
            const isExpanded = card.classList.toggle('is-expanded');
            toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            if (details) {
                details.setAttribute('aria-hidden', isExpanded ? 'false' : 'true');
                details.style.maxHeight = isExpanded ? `${details.scrollHeight}px` : '0px';
            }
        });
    }

    // 날짜 유효성 검사
    validateDates() {
        const startDate = document.getElementById('serviceStartDate').value;
        const endDate = document.getElementById('serviceEndDate').value;
        const endDateInput = document.getElementById('serviceEndDate');
        
        if (endDate && startDate && endDate < startDate) {
            endDateInput.setCustomValidity('구독 종료일은 시작일보다 이후여야 합니다.');
            endDateInput.style.borderColor = '#e53e3e';
        } else {
            endDateInput.setCustomValidity('');
            endDateInput.style.borderColor = '#e2e8f0';
        }
    }

    // 로컬 스토리지에서 데이터 로드
    loadFromStorage() {
        const stored = localStorage.getItem('subscriptions');
        return stored ? JSON.parse(stored) : [];
    }

    // 환율 로드/저장
    loadExchangeRate() {
        const stored = localStorage.getItem('exchangeRateKRW');
        return stored ? parseFloat(stored) : null;
    }

    loadExchangeRateUpdatedAt() {
        return localStorage.getItem('exchangeRateUpdatedAt');
    }

    saveExchangeRate(rate) {
        localStorage.setItem('exchangeRateKRW', String(rate));
        localStorage.setItem('exchangeRateUpdatedAt', new Date().toISOString());
        this.exchangeRateUpdatedAt = localStorage.getItem('exchangeRateUpdatedAt');
    }

    // 로컬 스토리지에 데이터 저장
    saveToStorage() {
        localStorage.setItem('subscriptions', JSON.stringify(this.subscriptions));
    }

    // 환율 업데이트
    async updateExchangeRate() {
        try {
            const response = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('환율 요청 실패');
            }
            const data = await response.json();
            const rate = data && data.rates ? data.rates.KRW : null;
            if (!rate) {
                throw new Error('환율 데이터 없음');
            }
            this.exchangeRate = rate;
            this.saveExchangeRate(rate);
            this.updateStats();
            this.render();
        } catch (error) {
            console.warn('환율 업데이트 실패:', error);
        }
    }

    startExchangeRatePolling() {
        // 6시간마다 환율 갱신
        setInterval(() => this.updateExchangeRate(), 6 * 60 * 60 * 1000);
    }

    // 새 구독 추가 또는 기존 구독 편집
    handleSubmit(e) {
        e.preventDefault();
        
        const startDate = document.getElementById('serviceStartDate').value;
        const endDate = document.getElementById('serviceEndDate').value;
        
        // 종료일 유효성 검사
        if (endDate && endDate < startDate) {
            alert('구독 종료일은 시작일보다 이후여야 합니다.');
            return;
        }
        
        const formData = {
            id: this.currentEditId || Date.now().toString(),
            name: document.getElementById('serviceName').value,
            expenseType: document.getElementById('serviceExpenseType').value,
            category: document.getElementById('serviceCategory').value,
            currency: document.getElementById('serviceCurrency').value,
            price: parseFloat(document.getElementById('servicePrice').value),
            billingCycle: document.getElementById('serviceBillingCycle').value,
            startDate: startDate,
            endDate: endDate || null,
            description: document.getElementById('serviceDescription').value
        };

        if (this.currentEditId) {
            // 편집 모드
            const index = this.subscriptions.findIndex(sub => sub.id === this.currentEditId);
            if (index !== -1) {
                this.subscriptions[index] = formData;
            }
        } else {
            // 추가 모드
            this.subscriptions.push(formData);
        }

        this.saveToStorage();
        this.closeModal();
        this.render();
        this.updateStats();
    }

    // 모달 열기
    openModal(serviceId = null) {
        const modal = document.getElementById('serviceModal');
        const form = document.getElementById('serviceForm');
        const title = document.getElementById('modalTitle');
        
        if (serviceId) {
            // 편집 모드
            const service = this.subscriptions.find(sub => sub.id === serviceId);
            if (service) {
                this.currentEditId = serviceId;
                title.textContent = '구독 편집';
                this.populateForm(service);
            }
        } else {
            // 추가 모드
            this.currentEditId = null;
            title.textContent = '새 구독 추가';
            form.reset();
            document.getElementById('serviceStartDate').value = new Date().toISOString().split('T')[0];
        }
        
        modal.classList.add('show');
    }

    // 모달 닫기
    closeModal() {
        const modal = document.getElementById('serviceModal');
        modal.classList.remove('show');
        this.currentEditId = null;
    }

    // 폼에 데이터 채우기 (편집용)
    populateForm(service) {
        document.getElementById('serviceName').value = service.name;
        document.getElementById('serviceExpenseType').value = service.expenseType || 'personal';
        document.getElementById('serviceCategory').value = service.category;
        document.getElementById('serviceCurrency').value = service.currency || 'KRW';
        document.getElementById('servicePrice').value = service.price;
        document.getElementById('serviceBillingCycle').value = service.billingCycle;
        document.getElementById('serviceStartDate').value = service.startDate;
        document.getElementById('serviceEndDate').value = service.endDate || '';
        document.getElementById('serviceDescription').value = service.description || '';
    }

    // 구독 삭제
    deleteService(serviceId) {
        if (confirm('정말로 이 구독을 삭제하시겠습니까?')) {
            this.subscriptions = this.subscriptions.filter(sub => sub.id !== serviceId);
            this.saveToStorage();
            this.render();
            this.updateStats();
        }
    }

    // 서비스 렌더링
    render() {
        const grid = document.getElementById('servicesGrid');
        const filteredServices = this.getFilteredServices();
        
        if (filteredServices.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-credit-card"></i>
                    <h3>구독 서비스가 없습니다</h3>
                    <p>새 구독을 추가하여 관리해보세요!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filteredServices.map(service => this.createServiceCard(service)).join('');
        this.syncDetailsHeights();
    }

    // 환율 변환 함수
    convertCurrency(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return amount;
        
        if (fromCurrency === 'USD' && toCurrency === 'KRW') {
            return amount * this.exchangeRate;
        } else if (fromCurrency === 'KRW' && toCurrency === 'USD') {
            return amount / this.exchangeRate;
        }
        return amount;
    }

    // 서비스 카드 생성
    createServiceCard(service) {
        const monthlyPrice = service.billingCycle === 'yearly' ? service.price / 12 : service.price;
        const yearlyPrice = service.billingCycle === 'monthly' ? service.price * 12 : service.price;
        
        const startDate = new Date(service.startDate);
        const endDate = service.endDate ? new Date(service.endDate) : null;
        const daysSinceStart = Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24));
        const expenseType = service.expenseType || 'personal';
        const currency = service.currency || 'KRW';
        
        // 구독 상태 확인
        const isExpired = endDate && new Date() > endDate;
        const isExpiringSoon = endDate && (endDate - new Date()) <= (30 * 24 * 60 * 60 * 1000) && !isExpired;
        const nextBillingDate = this.getNextBillingDate(service);
        const daysUntilBilling = nextBillingDate ? this.getDaysUntil(nextBillingDate) : null;
        const ddayLabel = isExpired ? '만료' : (daysUntilBilling === 0 ? 'D-Day' : `D-${daysUntilBilling}`);
        
        // 원화로 변환된 가격 계산
        const monthlyPriceKRW = this.convertCurrency(monthlyPrice, currency, 'KRW');
        const yearlyPriceKRW = this.convertCurrency(yearlyPrice, currency, 'KRW');
        
        // 달러로 변환된 가격 계산
        const monthlyPriceUSD = this.convertCurrency(monthlyPrice, currency, 'USD');
        const yearlyPriceUSD = this.convertCurrency(yearlyPrice, currency, 'USD');
        
        const currencySymbol = currency === 'USD' ? '$' : '₩';
        const displayPrice = currency === 'USD' ? monthlyPriceUSD : monthlyPrice;
        const displayYearlyPrice = currency === 'USD' ? yearlyPriceUSD : yearlyPrice;
        
        return `
            <div class="service-card ${isExpired ? 'expired' : ''} ${isExpiringSoon ? 'expiring-soon' : ''}">
                <div class="service-header">
                    <div>
                        <div class="service-name">
                            ${service.name}
                            <span class="expense-type-tag expense-type-${expenseType}">
                                ${expenseType === 'personal' ? '개인' : '회사'}
                            </span>
                            ${isExpired ? '<span class="status-tag expired">만료됨</span>' : ''}
                            ${isExpiringSoon ? '<span class="status-tag expiring-soon">만료 예정</span>' : ''}
                        </div>
                        <span class="service-category category-${service.category}">${this.getCategoryName(service.category)}</span>
                    </div>
                    <div class="service-header-actions">
                        <span class="dday-badge ${isExpired ? 'expired' : (daysUntilBilling !== null && daysUntilBilling <= 3 ? 'soon' : '')}">
                            ${ddayLabel}
                        </span>
                        <button class="details-toggle" type="button" aria-expanded="false" aria-label="상세 보기 토글">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                
                <div class="service-price">
                    ${currencySymbol}${displayPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}/월
                    <span class="currency-tag currency-${currency.toLowerCase()}">${currency}</span>
                </div>

                <div class="service-details-collapsible" aria-hidden="true">
                    <div class="service-details">
                        <div class="service-detail">
                            <span class="service-detail-label">연간 비용</span>
                            <span class="service-detail-value">${currencySymbol}${displayYearlyPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                        </div>
                        <div class="service-detail">
                            <span class="service-detail-label">결제 주기</span>
                            <span class="service-detail-value">${service.billingCycle === 'monthly' ? '월간' : '연간'}</span>
                        </div>
                        <div class="service-detail">
                            <span class="service-detail-label">구독 기간</span>
                            <span class="service-detail-value">${daysSinceStart}일</span>
                        </div>
                        ${endDate ? `
                        <div class="service-detail">
                            <span class="service-detail-label">구독 종료일</span>
                            <span class="service-detail-value ${isExpired ? 'expired' : ''} ${isExpiringSoon ? 'expiring-soon' : ''}">
                                ${endDate.toLocaleDateString('ko-KR')}
                            </span>
                        </div>
                        ` : `
                        <div class="service-detail">
                            <span class="service-detail-label">구독 상태</span>
                            <span class="service-detail-value">무기한</span>
                        </div>
                        `}
                        ${currency !== 'KRW' ? `
                        <div class="service-detail">
                            <span class="service-detail-label">원화 환산 (월)</span>
                            <span class="service-detail-value">₩${Math.round(monthlyPriceKRW).toLocaleString()}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${service.description ? `<div class="service-description">${service.description}</div>` : ''}
                    
                    <div class="service-actions">
                        <button class="btn btn-primary btn-small" onclick="subscriptionManager.openModal('${service.id}')">
                            <i class="fas fa-edit"></i> 편집
                        </button>
                        <button class="btn btn-danger btn-small" onclick="subscriptionManager.deleteService('${service.id}')">
                            <i class="fas fa-trash"></i> 삭제
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // 다음 결제일 계산
    getNextBillingDate(service) {
        const startDate = new Date(service.startDate);
        const endDate = service.endDate ? new Date(service.endDate) : null;
        const today = this.normalizeDate(new Date());

        if (endDate && today > this.normalizeDate(endDate)) {
            return null;
        }

        const startDay = startDate.getDate();
        if (service.billingCycle === 'yearly') {
            const candidate = new Date(today.getFullYear(), startDate.getMonth(), startDay);
            const normalized = this.normalizeDate(candidate);
            if (normalized < today) {
                return this.normalizeDate(new Date(today.getFullYear() + 1, startDate.getMonth(), startDay));
            }
            return normalized;
        }

        const candidate = new Date(today.getFullYear(), today.getMonth(), startDay);
        const normalized = this.normalizeDate(candidate);
        if (normalized < today) {
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, startDay);
            return this.normalizeDate(nextMonth);
        }
        return normalized;
    }

    getDaysUntil(targetDate) {
        const today = this.normalizeDate(new Date());
        const target = this.normalizeDate(targetDate);
        return Math.max(0, Math.ceil((target - today) / (1000 * 60 * 60 * 24)));
    }

    normalizeDate(date) {
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        return normalized;
    }

    // 상세영역 높이 동기화 (재렌더 시)
    syncDetailsHeights() {
        document.querySelectorAll('.service-card').forEach(card => {
            const details = card.querySelector('.service-details-collapsible');
            const toggleBtn = card.querySelector('.details-toggle');
            if (!details || !toggleBtn) return;
            details.style.maxHeight = '0px';
            toggleBtn.setAttribute('aria-expanded', 'false');
            details.setAttribute('aria-hidden', 'true');
        });
    }

    // 탭 전환
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // 탭 버튼 활성화 상태 업데이트
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // 통계 섹션 표시/숨김
        document.querySelectorAll('.stats-section').forEach(section => {
            section.style.display = 'none';
        });
        
        if (tabName === 'all') {
            document.getElementById('allStats').style.display = 'block';
        } else if (tabName === 'personal') {
            document.getElementById('personalStats').style.display = 'block';
        } else if (tabName === 'company') {
            document.getElementById('companyStats').style.display = 'block';
        }
        
        this.render();
        this.updateStats();
    }

    // 필터링된 서비스 가져오기
    getFilteredServices() {
        const categoryFilter = document.getElementById('categoryFilter').value;
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        
        const filtered = this.subscriptions.filter(service => {
            // 탭별 필터링
            const matchesTab = this.currentTab === 'all' || service.expenseType === this.currentTab;
            const matchesCategory = !categoryFilter || service.category === categoryFilter;
            const matchesSearch = !searchTerm || 
                service.name.toLowerCase().includes(searchTerm) ||
                (service.description && service.description.toLowerCase().includes(searchTerm));
            
            return matchesTab && matchesCategory && matchesSearch;
        });

        // 결제일 임박 순 정렬 (만료는 뒤로)
        return filtered.sort((a, b) => {
            const nextA = this.getNextBillingDate(a);
            const nextB = this.getNextBillingDate(b);
            if (!nextA && !nextB) return 0;
            if (!nextA) return 1;
            if (!nextB) return -1;
            return nextA - nextB;
        });
    }

    // 서비스 필터링
    filterServices() {
        this.render();
    }

    // 통계 업데이트
    updateStats() {
        this.updateAllStats();
        this.updatePersonalStats();
        this.updateCompanyStats();
    }

    // 전체 통계 업데이트
    updateAllStats() {
        const totalSubscriptions = this.subscriptions.length;
        
        // 개인 지출 계산 (원화)
        const personalMonthlyCostKRW = this.subscriptions
            .filter(service => service.expenseType === 'personal')
            .reduce((total, service) => {
                const monthlyPrice = service.billingCycle === 'yearly' ? service.price / 12 : service.price;
                return total + this.convertCurrency(monthlyPrice, service.currency || 'KRW', 'KRW');
            }, 0);
        
        // 개인 지출 계산 (달러)
        const personalMonthlyCostUSD = this.subscriptions
            .filter(service => service.expenseType === 'personal')
            .reduce((total, service) => {
                const monthlyPrice = service.billingCycle === 'yearly' ? service.price / 12 : service.price;
                return total + this.convertCurrency(monthlyPrice, service.currency || 'KRW', 'USD');
            }, 0);
        
        // 회사 지출 계산 (원화)
        const companyMonthlyCostKRW = this.subscriptions
            .filter(service => service.expenseType === 'company')
            .reduce((total, service) => {
                const monthlyPrice = service.billingCycle === 'yearly' ? service.price / 12 : service.price;
                return total + this.convertCurrency(monthlyPrice, service.currency || 'KRW', 'KRW');
            }, 0);
        
        // 회사 지출 계산 (달러)
        const companyMonthlyCostUSD = this.subscriptions
            .filter(service => service.expenseType === 'company')
            .reduce((total, service) => {
                const monthlyPrice = service.billingCycle === 'yearly' ? service.price / 12 : service.price;
                return total + this.convertCurrency(monthlyPrice, service.currency || 'KRW', 'USD');
            }, 0);
        
        // 총 월간 비용
        const totalMonthlyCostKRW = personalMonthlyCostKRW + companyMonthlyCostKRW;
        const totalMonthlyCostUSD = personalMonthlyCostUSD + companyMonthlyCostUSD;

        document.getElementById('totalSubscriptions').textContent = totalSubscriptions;
        document.getElementById('personalMonthlyCostKRW').textContent = `₩${Math.round(personalMonthlyCostKRW).toLocaleString()}`;
        document.getElementById('personalMonthlyCostUSD').textContent = `$${personalMonthlyCostUSD.toFixed(2)}`;
        document.getElementById('companyMonthlyCostKRW').textContent = `₩${Math.round(companyMonthlyCostKRW).toLocaleString()}`;
        document.getElementById('companyMonthlyCostUSD').textContent = `$${companyMonthlyCostUSD.toFixed(2)}`;
        document.getElementById('totalMonthlyCostKRW').textContent = `₩${Math.round(totalMonthlyCostKRW).toLocaleString()}`;
        document.getElementById('totalMonthlyCostUSD').textContent = `$${totalMonthlyCostUSD.toFixed(2)}`;
    }

    // 개인 지출 통계 업데이트
    updatePersonalStats() {
        const personalServices = this.subscriptions.filter(service => service.expenseType === 'personal');
        const personalTotalSubscriptions = personalServices.length;
        
        const personalMonthlyCostKRW = personalServices.reduce((total, service) => {
            const monthlyPrice = service.billingCycle === 'yearly' ? service.price / 12 : service.price;
            return total + this.convertCurrency(monthlyPrice, service.currency || 'KRW', 'KRW');
        }, 0);
        
        const personalMonthlyCostUSD = personalServices.reduce((total, service) => {
            const monthlyPrice = service.billingCycle === 'yearly' ? service.price / 12 : service.price;
            return total + this.convertCurrency(monthlyPrice, service.currency || 'KRW', 'USD');
        }, 0);
        
        const personalYearlyCostKRW = personalServices.reduce((total, service) => {
            const yearlyPrice = service.billingCycle === 'monthly' ? service.price * 12 : service.price;
            return total + this.convertCurrency(yearlyPrice, service.currency || 'KRW', 'KRW');
        }, 0);
        
        const personalYearlyCostUSD = personalServices.reduce((total, service) => {
            const yearlyPrice = service.billingCycle === 'monthly' ? service.price * 12 : service.price;
            return total + this.convertCurrency(yearlyPrice, service.currency || 'KRW', 'USD');
        }, 0);

        document.getElementById('personalTotalSubscriptions').textContent = personalTotalSubscriptions;
        document.getElementById('personalOnlyMonthlyCostKRW').textContent = `₩${Math.round(personalMonthlyCostKRW).toLocaleString()}`;
        document.getElementById('personalOnlyMonthlyCostUSD').textContent = `$${personalMonthlyCostUSD.toFixed(2)}`;
        document.getElementById('personalOnlyYearlyCostKRW').textContent = `₩${Math.round(personalYearlyCostKRW).toLocaleString()}`;
        document.getElementById('personalOnlyYearlyCostUSD').textContent = `$${personalYearlyCostUSD.toFixed(2)}`;
    }

    // 회사 지출 통계 업데이트
    updateCompanyStats() {
        const companyServices = this.subscriptions.filter(service => service.expenseType === 'company');
        const companyTotalSubscriptions = companyServices.length;
        
        const companyMonthlyCostKRW = companyServices.reduce((total, service) => {
            const monthlyPrice = service.billingCycle === 'yearly' ? service.price / 12 : service.price;
            return total + this.convertCurrency(monthlyPrice, service.currency || 'KRW', 'KRW');
        }, 0);
        
        const companyMonthlyCostUSD = companyServices.reduce((total, service) => {
            const monthlyPrice = service.billingCycle === 'yearly' ? service.price / 12 : service.price;
            return total + this.convertCurrency(monthlyPrice, service.currency || 'KRW', 'USD');
        }, 0);
        
        const companyYearlyCostKRW = companyServices.reduce((total, service) => {
            const yearlyPrice = service.billingCycle === 'monthly' ? service.price * 12 : service.price;
            return total + this.convertCurrency(yearlyPrice, service.currency || 'KRW', 'KRW');
        }, 0);
        
        const companyYearlyCostUSD = companyServices.reduce((total, service) => {
            const yearlyPrice = service.billingCycle === 'monthly' ? service.price * 12 : service.price;
            return total + this.convertCurrency(yearlyPrice, service.currency || 'KRW', 'USD');
        }, 0);

        document.getElementById('companyTotalSubscriptions').textContent = companyTotalSubscriptions;
        document.getElementById('companyOnlyMonthlyCostKRW').textContent = `₩${Math.round(companyMonthlyCostKRW).toLocaleString()}`;
        document.getElementById('companyOnlyMonthlyCostUSD').textContent = `$${companyMonthlyCostUSD.toFixed(2)}`;
        document.getElementById('companyOnlyYearlyCostKRW').textContent = `₩${Math.round(companyYearlyCostKRW).toLocaleString()}`;
        document.getElementById('companyOnlyYearlyCostUSD').textContent = `$${companyYearlyCostUSD.toFixed(2)}`;
    }

    // 카테고리 이름 가져오기
    getCategoryName(category) {
        const categoryNames = {
            'streaming': '스트리밍',
            'music': '음악',
            'software': '소프트웨어',
            'shopping': '쇼핑',
            'fitness': '피트니스',
            'other': '기타'
        };
        return categoryNames[category] || '기타';
    }

    // 데이터 내보내기
    exportData() {
        try {
            const exportData = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                subscriptions: this.subscriptions,
                totalCount: this.subscriptions.length
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `구독관리_백업_${new Date().toISOString().split('T')[0]}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showNotification('데이터가 성공적으로 내보내졌습니다!', 'success');
        } catch (error) {
            console.error('내보내기 오류:', error);
            this.showNotification('내보내기 중 오류가 발생했습니다.', 'error');
        }
    }

    // 가져오기 트리거
    triggerImport() {
        document.getElementById('importFile').click();
    }

    // 데이터 가져오기
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // 데이터 유효성 검사
                if (!this.validateImportData(importedData)) {
                    this.showNotification('잘못된 파일 형식입니다.', 'error');
                    return;
                }

                // 기존 데이터 덮어쓰기 확인
                if (this.subscriptions.length > 0) {
                    if (!confirm(`기존 데이터 ${this.subscriptions.length}개가 모두 삭제되고 새 데이터로 교체됩니다. 계속하시겠습니까?`)) {
                        return;
                    }
                }

                // 데이터 가져오기
                this.subscriptions = importedData.subscriptions || [];
                this.saveToStorage();
                this.render();
                this.updateStats();
                
                this.showNotification(`${importedData.subscriptions.length}개의 구독 데이터를 성공적으로 가져왔습니다!`, 'success');
                
            } catch (error) {
                console.error('가져오기 오류:', error);
                this.showNotification('파일을 읽는 중 오류가 발생했습니다.', 'error');
            }
        };
        
        reader.readAsText(file);
        
        // 파일 입력 초기화
        event.target.value = '';
    }

    // 가져오기 데이터 유효성 검사
    validateImportData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!Array.isArray(data.subscriptions)) return false;
        
        // 각 구독 항목 검사
        for (const subscription of data.subscriptions) {
            if (!subscription.id || !subscription.name || !subscription.price) {
                return false;
            }
        }
        
        return true;
    }

    // 업데이트 확인
    checkForUpdates() {
        // Service Worker 업데이트 확인
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(registration => {
                if (registration) {
                    registration.update();
                }
            });
        }
        
        // 캐시 클리어 (개발 중)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('개발 환경: 캐시 클리어');
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => {
                        caches.delete(name);
                    });
                });
            }
        }
    }

    // 알림 표시
    showNotification(message, type = 'info') {
        // 기존 알림 제거
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
}

// 페이지 로드 시 구독 관리자 초기화
let subscriptionManager;
let deferredPrompt;

document.addEventListener('DOMContentLoaded', () => {
    subscriptionManager = new SubscriptionManager();
    registerServiceWorker();
    setupInstallPrompt();
});

// PWA 서비스 워커 등록
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then((registration) => {
                    console.log('SW 등록 성공: ', registration);
                })
                .catch((registrationError) => {
                    console.log('SW 등록 실패: ', registrationError);
                });
        });
    }
}

// PWA 설치 프롬프트 설정 (자동 설치만 지원)
function setupInstallPrompt() {
    console.log('PWA 설치 프롬프트 설정 시작');
    console.log('User Agent:', navigator.userAgent);
    console.log('isMobile:', isMobile());
    
    // 설치 가능한 이벤트 감지 (자동 설치만)
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt 이벤트 발생 - 자동 설치만 지원');
        // 기본 설치 프롬프트 허용 (자동 설치)
        // e.preventDefault() 제거
    });
    
    // 앱이 설치되었을 때
    window.addEventListener('appinstalled', () => {
        console.log('PWA가 설치되었습니다');
    });
}

// 모바일 환경 감지 (필요시 사용)
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// PWA 설치 관련 함수들은 제거 (자동 설치만 지원)

// 오프라인 상태 감지
window.addEventListener('online', () => {
    console.log('온라인 상태');
    showOnlineStatus();
});

window.addEventListener('offline', () => {
    console.log('오프라인 상태');
    showOfflineStatus();
});

// 온라인 상태 표시
function showOnlineStatus() {
    const status = document.getElementById('connectionStatus');
    if (status) {
        status.textContent = '온라인';
        status.className = 'connection-status online';
    }
}

// 오프라인 상태 표시
function showOfflineStatus() {
    const status = document.getElementById('connectionStatus');
    if (status) {
        status.textContent = '오프라인';
        status.className = 'connection-status offline';
    }
}

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    // ESC 키로 모달 닫기
    if (e.key === 'Escape') {
        const modal = document.getElementById('serviceModal');
        if (modal.classList.contains('show')) {
            subscriptionManager.closeModal();
        }
    }
    
    // Ctrl/Cmd + N으로 새 구독 추가
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        subscriptionManager.openModal();
    }
});
