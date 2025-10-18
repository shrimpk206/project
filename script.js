// 구독 서비스 관리자 JavaScript

class SubscriptionManager {
    constructor() {
        this.subscriptions = this.loadFromStorage();
        this.currentEditId = null;
        this.exchangeRate = 1423.50; // 실시간 환율 (1 USD = 1423.50 KRW) - 네이버 증권 기준
        this.currentTab = 'all'; // 현재 활성 탭
        this.init();
    }

    init() {
        this.bindEvents();
        this.render();
        this.updateStats();
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
    }

    // 로컬 스토리지에서 데이터 로드
    loadFromStorage() {
        const stored = localStorage.getItem('subscriptions');
        return stored ? JSON.parse(stored) : [];
    }

    // 로컬 스토리지에 데이터 저장
    saveToStorage() {
        localStorage.setItem('subscriptions', JSON.stringify(this.subscriptions));
    }

    // 새 구독 추가 또는 기존 구독 편집
    handleSubmit(e) {
        e.preventDefault();
        
        const formData = {
            id: this.currentEditId || Date.now().toString(),
            name: document.getElementById('serviceName').value,
            expenseType: document.getElementById('serviceExpenseType').value,
            category: document.getElementById('serviceCategory').value,
            currency: document.getElementById('serviceCurrency').value,
            price: parseFloat(document.getElementById('servicePrice').value),
            billingCycle: document.getElementById('serviceBillingCycle').value,
            startDate: document.getElementById('serviceStartDate').value,
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
        const daysSinceStart = Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24));
        const expenseType = service.expenseType || 'personal';
        const currency = service.currency || 'KRW';
        
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
            <div class="service-card">
                <div class="service-header">
                    <div>
                        <div class="service-name">
                            ${service.name}
                            <span class="expense-type-tag expense-type-${expenseType}">
                                ${expenseType === 'personal' ? '개인' : '회사'}
                            </span>
                        </div>
                        <span class="service-category category-${service.category}">${this.getCategoryName(service.category)}</span>
                    </div>
                </div>
                
                <div class="service-price">
                    ${currencySymbol}${displayPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}/월
                    <span class="currency-tag currency-${currency.toLowerCase()}">${currency}</span>
                </div>
                
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
        `;
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
        
        return this.subscriptions.filter(service => {
            // 탭별 필터링
            const matchesTab = this.currentTab === 'all' || service.expenseType === this.currentTab;
            const matchesCategory = !categoryFilter || service.category === categoryFilter;
            const matchesSearch = !searchTerm || 
                service.name.toLowerCase().includes(searchTerm) ||
                (service.description && service.description.toLowerCase().includes(searchTerm));
            
            return matchesTab && matchesCategory && matchesSearch;
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
}

// 페이지 로드 시 구독 관리자 초기화
let subscriptionManager;

document.addEventListener('DOMContentLoaded', () => {
    subscriptionManager = new SubscriptionManager();
});

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
