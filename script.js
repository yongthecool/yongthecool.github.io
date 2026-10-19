// ============================================================
// SGI서울보증 행복대리점 - JavaScript 로직
// 납세보증보험 모의 계산기, 원클릭 복사, 상담 폼 접수 처리
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. 모바일 햄버거 메뉴 토글
    const mobileToggle = document.getElementById('mobile-toggle');
    const navLinks = document.getElementById('nav-links');

    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });

        document.querySelectorAll('.nav-link, .nav-btn-call').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });
    }

    // 2. 납세보증보험료 모의 계산기 실시간 연동
    const calcType = document.getElementById('calc-tax-type');
    const calcAmount = document.getElementById('calc-amount');
    const calcMonths = document.getElementById('calc-months');
    const calcKorean = document.getElementById('calc-amount-korean');
    const resultRate = document.getElementById('result-rate');
    const resultPremium = document.getElementById('result-premium');

    // 숫자를 한글 금액 단위(억, 만원)로 변환
    function formatKoreanMoney(val) {
        if (!val || val <= 0) return '0원';
        const num = Number(val);
        const eok = Math.floor(num / 100000000);
        const man = Math.floor((num % 100000000) / 10000);
        let str = '';
        if (eok > 0) str += `${eok}억 `;
        if (man > 0) str += `${man.toLocaleString()}만 `;
        str += '원';
        return str;
    }

    // 보증료 계산 실행
    function calculatePremium() {
        if (!calcAmount || !calcMonths || !calcType) return;

        const amount = Number(calcAmount.value) || 0;
        const months = Number(calcMonths.value) || 12;
        const type = calcType.value;

        // 한국어 금액 라벨 업데이트
        calcKorean.textContent = formatKoreanMoney(amount);

        // 보증 요율 설정 (평균 기준율)
        let rate = 0.0095; // 기본 0.95%
        let rateText = '약 0.95%';

        if (type === 'inheritance') {
            rate = 0.0095;
            rateText = '약 0.95% (상속세)';
        } else if (type === 'gift') {
            rate = 0.0095;
            rateText = '약 0.95% (증여세)';
        } else {
            rate = 0.0110;
            rateText = '약 1.10% (일반세무)';
        }

        resultRate.textContent = rateText;

        // 총 예상 보증료 = 보증금액 * 연요율 * (기간월 / 12)
        const years = months / 12;
        const premium = Math.round(amount * rate * years);

        resultPremium.textContent = `${premium.toLocaleString()} 원`;
    }

    if (calcAmount && calcMonths && calcType) {
        calcAmount.addEventListener('input', calculatePremium);
        calcMonths.addEventListener('change', calculatePremium);
        calcType.addEventListener('change', calculatePremium);
        // 초기 실행
        calculatePremium();
    }

    // 3. 상담 폼 접수 이벤트
    const insuranceForm = document.getElementById('insurance-form');
    if (insuranceForm) {
        insuranceForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const clientName = document.getElementById('client-name').value;
            const consultType = document.getElementById('consult-type').value;

            showToast(`✅ ${clientName}님, [${consultType}] 상담 신청이 정상 접수되었습니다! 장용태 심사역이 곧 유선으로 안내드리겠습니다.`);
            insuranceForm.reset();
        });
    }
});

// 4. 모의 견적 상담 폼으로 전달 및 스크롤
window.requestWithCalc = function() {
    const calcAmount = document.getElementById('calc-amount');
    const calcType = document.getElementById('calc-tax-type');
    const targetAmountInput = document.getElementById('target-amount');
    const consultTypeSelect = document.getElementById('consult-type');
    const consultSection = document.getElementById('consultation');

    if (calcAmount && targetAmountInput) {
        const val = Number(calcAmount.value) || 0;
        const eok = val / 100000000;
        targetAmountInput.value = `${eok}억 원`;
    }

    if (calcType && consultTypeSelect) {
        if (calcType.value === 'inheritance') {
            consultTypeSelect.value = '상속세 연부연납 납세보증';
        } else if (calcType.value === 'gift') {
            consultTypeSelect.value = '증여세 분납 납세보증';
        }
    }

    if (consultSection) {
        consultSection.scrollIntoView({ behavior: 'smooth' });
        showToast('📝 모의 견적 정보가 상담 폼에 자동 입력되었습니다.');
    }
};

// 5. 연락처/주소 클립보드 복사 함수
window.copyContact = function(text, labelName) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`📋 ${labelName}이(가) 클립보드에 복사되었습니다: ${text}`);
        }).catch(() => {
            fallbackCopy(text, labelName);
        });
    } else {
        fallbackCopy(text, labelName);
    }
};

function fallbackCopy(text, labelName) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast(`📋 ${labelName}이(가) 복사되었습니다: ${text}`);
}

// 6. 공통 토스트 알림 팝업
let toastTimeout = null;
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
