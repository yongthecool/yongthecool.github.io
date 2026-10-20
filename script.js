// ============================================================
// SGI서울보증 행복대리점 - JavaScript 로직
// 납세보증보험 모의 계산기, 원클릭 복사, 상담 폼 접수 처리
// ============================================================

// ============================================================
// ★ 연부연납 납세보증보험료 요율 및 기준 설정
// 향후 가산세율이나 보험요율이 변동될 경우, 아래 수치만 수정하시면 전체 사이트에 즉시 반영됩니다.
// ============================================================
const TAX_INSURANCE_CONFIG = {
    // 1. 국세기본법 연부연납 가산세율 (현재 연 3.10%)
    ADDITIONAL_TAX_RATE: 0.0310,

    // 2. SGI서울보증 연간 기본 보증보험요율 (현재 연 0.561%)
    INSURANCE_RATE: 0.00561,

    // 3. 국세청 제출 담보비율 (통상 110%)
    COLLATERAL_RATIO: 1.10,

    // 4. 보증기간 추가 일수 (통상 익일 만료 1일 추가)
    EXTRA_DAYS: 1,

    // 5. 보험가입금액 올림 단위 (국세청 실무: 천 원 단위 올림)
    ROUND_UNIT: 1000
};

// ============================================================
// 유틸리티 함수: 전화번호 자동 하이픈 포맷팅
// ex: 01089568800 -> 010-8956-8800
// ex: 0233455678  -> 02-3345-5678
// ex: 07012345678 -> 070-1234-5678
// ============================================================
function formatPhoneNumber(value) {
    if (!value) return '';
    const clean = value.replace(/[^0-9]/g, '');

    // 1. 서울 지역번호 (02)
    if (clean.startsWith('02')) {
        if (clean.length < 3) return clean;
        if (clean.length <= 5) return clean.replace(/(\d{2})(\d+)/, '$1-$2');
        if (clean.length <= 9) return clean.replace(/(\d{2})(\d{3})(\d+)/, '$1-$2-$3');
        return clean.slice(0, 10).replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
    }

    // 2. 전국 대표번호 (1566, 1588, 1600 등)
    if (clean.startsWith('15') || clean.startsWith('16') || clean.startsWith('18')) {
        if (clean.length <= 4) return clean;
        return clean.slice(0, 8).replace(/(\d{4})(\d+)/, '$1-$2');
    }

    // 3. 일반 휴대폰(010), 인터넷전화(070), 시도 지역번호(031, 051 등)
    if (clean.length < 4) return clean;
    if (clean.length <= 7) return clean.replace(/(\d{3})(\d+)/, '$1-$2');
    if (clean.length <= 10) return clean.replace(/(\d{3})(\d{3})(\d+)/, '$1-$2-$3');
    return clean.slice(0, 11).replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
}

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

    // 2. 화면 상단 요율 뱃지 동적 표시 (CONFIG 값 자동 바인딩)
    const dispAdditional = document.getElementById('disp-additional-rate');
    const dispInsurance = document.getElementById('disp-insurance-rate');
    if (dispAdditional) {
        dispAdditional.textContent = (TAX_INSURANCE_CONFIG.ADDITIONAL_TAX_RATE * 100).toFixed(2) + '%';
    }
    if (dispInsurance) {
        dispInsurance.textContent = '연 ' + (TAX_INSURANCE_CONFIG.INSURANCE_RATE * 100).toFixed(3) + '%';
    }

    // 3. 납세보증보험료 모의 계산기 요소
    const calcType = document.getElementById('calc-tax-type');
    const calcAmount = document.getElementById('calc-amount');
    const calcMonths = document.getElementById('calc-months');
    const resultPremium = document.getElementById('result-premium');

    // 보증 기간 옵션 동적 업데이트 (증여세: 1~5년(기본 5년) / 상속세: 1~10년(기본 10년))
    function updatePeriodOptions(type, preserveSelection = false) {
        if (!calcMonths) return;

        const currentVal = parseInt(calcMonths.value, 10);
        const maxYears = (type === 'inheritance') ? 10 : 5;

        calcMonths.innerHTML = '';
        for (let y = 1; y <= maxYears; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = `${y}년 (${y}회 분납)`;
            calcMonths.appendChild(opt);
        }

        if (preserveSelection && currentVal && currentVal <= maxYears) {
            calcMonths.value = currentVal;
        } else {
            // 기본값: 증여세는 5년, 상속세는 10년
            calcMonths.value = maxYears;
        }
    }

    // 엑셀 수식 기반 연부연납 차수별 계산 및 총 예상 보증보험료 산출
    function calculatePremium() {
        if (!calcAmount || !calcMonths || !calcType || !resultPremium) return;

        // 천단위 쉼표 제거 후 순수 숫자 파싱
        const rawNumStr = calcAmount.value.replace(/[^0-9]/g, '');
        const totalTax = Number(rawNumStr) || 0;
        const terms = parseInt(calcMonths.value, 10) || 1;

        if (totalTax <= 0) {
            resultPremium.textContent = '0 원';
            renderScheduleTable([], null);
            return;
        }

        const principalPerTerm = totalTax / terms;
        const rows = [];

        let totalPrincipal = 0;
        let totalInterest = 0;
        let totalExpectedTax = 0;
        let totalInsAmountCeil = 0;
        let totalPremium = 0;

        for (let i = 1; i <= terms; i++) {
            // 차수별 세액잔액 = 대상세액 - 1회차본세 * (i - 1)
            const remPrincipal = totalTax - principalPerTerm * (i - 1);

            // 가산금 = 세액잔액 * 가산세율
            const interest = remPrincipal * TAX_INSURANCE_CONFIG.ADDITIONAL_TAX_RATE;

            // 납부예정세액 = 본세 + 가산금
            const expectedTax = principalPerTerm + interest;

            // 담보가입금액 = 납부예정세액 * 110%
            const insAmount = expectedTax * TAX_INSURANCE_CONFIG.COLLATERAL_RATIO;

            // 천 단위 올림 (국세청 기준)
            const insAmountCeil = Math.ceil(insAmount / TAX_INSURANCE_CONFIG.ROUND_UNIT) * TAX_INSURANCE_CONFIG.ROUND_UNIT;

            // 엑셀 수식: 가입금액 * 보험요율 * i + 가입금액 * (보험요율 / 365) * 추가일수
            const premTerm = insAmountCeil * TAX_INSURANCE_CONFIG.INSURANCE_RATE * i;
            const premExtra = insAmountCeil * (TAX_INSURANCE_CONFIG.INSURANCE_RATE / 365.0) * TAX_INSURANCE_CONFIG.EXTRA_DAYS;
            const premTotal = premTerm + premExtra;

            totalPrincipal += principalPerTerm;
            totalInterest += interest;
            totalExpectedTax += expectedTax;
            totalInsAmountCeil += insAmountCeil;
            totalPremium += premTotal;

            rows.push({
                term: `${i}차분`,
                remPrincipal: Math.round(remPrincipal),
                principal: Math.round(principalPerTerm),
                interest: Math.round(interest),
                expectedTax: Math.round(expectedTax),
                insAmountCeil: insAmountCeil,
                premium: Math.round(premTotal)
            });
        }

        const summary = {
            totalPrincipal: Math.round(totalPrincipal),
            totalInterest: Math.round(totalInterest),
            totalExpectedTax: Math.round(totalExpectedTax),
            totalInsAmountCeil: totalInsAmountCeil,
            totalPremium: Math.round(totalPremium)
        };

        // 총 예상 보증보험료 화면 표시
        resultPremium.textContent = `${summary.totalPremium.toLocaleString()} 원`;

        // 상세 테이블 렌더링
        renderScheduleTable(rows, summary);
    }

    // 상세 테이블 렌더링 함수
    function renderScheduleTable(rows, summary) {
        const tbody = document.getElementById('schedule-table-body');
        const tfoot = document.getElementById('schedule-table-foot');
        if (!tbody || !tfoot) return;

        tbody.innerHTML = '';
        tfoot.innerHTML = '';

        if (!rows || rows.length === 0) return;

        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.term}</td>
                <td>${r.principal.toLocaleString()}</td>
                <td>${r.interest.toLocaleString()}</td>
                <td>${r.expectedTax.toLocaleString()}</td>
                <td>${r.insAmountCeil.toLocaleString()}</td>
                <td><strong>${r.premium.toLocaleString()}</strong></td>
            `;
            tbody.appendChild(tr);
        });

        if (summary) {
            const footTr = document.createElement('tr');
            footTr.innerHTML = `
                <td>합계</td>
                <td>${summary.totalPrincipal.toLocaleString()}</td>
                <td>${summary.totalInterest.toLocaleString()}</td>
                <td>${summary.totalExpectedTax.toLocaleString()}</td>
                <td>${summary.totalInsAmountCeil.toLocaleString()}</td>
                <td><strong>${summary.totalPremium.toLocaleString()} 원</strong></td>
            `;
            tfoot.appendChild(footTr);
        }
    }

    // 이벤트 리스너 등록
    if (calcType && calcAmount && calcMonths) {
        // 보증 종류 변경 시 기간 재생성 (증여세 기본 5년, 상속세 기본 10년)
        calcType.addEventListener('change', () => {
            updatePeriodOptions(calcType.value, false);
            calculatePremium();
        });

        // 세액 입력 시: 숫자만 걸러내고 천단위 쉼표 실시간 적용
        calcAmount.addEventListener('input', () => {
            const clean = calcAmount.value.replace(/[^0-9]/g, '');
            if (clean) {
                calcAmount.value = Number(clean).toLocaleString('ko-KR');
            } else {
                calcAmount.value = '';
            }
            calculatePremium();
        });

        // 보증 기간 변경 시
        calcMonths.addEventListener('change', calculatePremium);

        // 초기화
        updatePeriodOptions(calcType.value, false);
        calculatePremium();
    }

    // 4. 연락처 입력 시 실시간 자동 하이픈(-) 적용
    const clientPhoneInput = document.getElementById('client-phone');
    if (clientPhoneInput) {
        clientPhoneInput.addEventListener('input', (e) => {
            e.target.value = formatPhoneNumber(e.target.value);
        });
    }

    // 5. 상담 폼 접수 이벤트 (8470005@naver.com 메일 전송 + 개인정보 동의 검증)
    const insuranceForm = document.getElementById('insurance-form');
    const submitBtn = document.getElementById('btn-submit-consult');

    if (insuranceForm) {
        insuranceForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 개인정보 취급방침 동의 여부 필수 검증
            const privacyAgreeYes = document.getElementById('privacy-agree-yes');
            if (!privacyAgreeYes || !privacyAgreeYes.checked) {
                showToast('⚠️ 개인정보 수집 및 이용에 ‘동의함’을 선택하셔야 상담 신청이 가능합니다.');
                const consentCard = document.getElementById('privacy-consent-card');
                if (consentCard) {
                    consentCard.classList.add('highlight-warning');
                    consentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        consentCard.classList.remove('highlight-warning');
                    }, 1500);
                }
                if (privacyAgreeYes) {
                    privacyAgreeYes.focus();
                }
                return;
            }

            const clientName = document.getElementById('client-name')?.value.trim() || '고객';
            const clientPhone = document.getElementById('client-phone')?.value.trim() || '';
            const consultType = document.getElementById('consult-type')?.value || '보증 상담';
            const targetAmount = document.getElementById('target-amount')?.value.trim() || '미정';
            const clientMemo = document.getElementById('client-memo')?.value.trim() || '';

            // 버튼 전송 중 로딩 상태
            const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>메일 전송 중입니다...</span>';
            }

            const formData = new FormData();
            formData.append('성함_기업명', clientName);
            formData.append('연락처', clientPhone);
            formData.append('보증종목', consultType);
            formData.append('예상보증_세액금액', targetAmount);
            formData.append('문의상세내용', clientMemo);
            formData.append('개인정보_수집이용_동의', '동의완료');
            formData.append('_subject', `[서울보증 행복대리점] ${clientName}님의 ${consultType} 상담 신청`);
            formData.append('_template', 'table');
            formData.append('_captcha', 'false');

            try {
                const response = await fetch('https://formsubmit.co/ajax/8470005@naver.com', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    showToast(`✅ ${clientName}님, [${consultType}] 상담 신청서가 행복대리점(8470005@naver.com)으로 정상 전송되었습니다! 곧 유선으로 안내드리겠습니다.`);
                    insuranceForm.reset();
                    // 라디오 버튼 기본값(동의안함)으로 리셋
                    const privacyAgreeNo = document.getElementById('privacy-agree-no');
                    if (privacyAgreeNo) privacyAgreeNo.checked = true;
                } else {
                    // API 응답 오류 시 표준 폼 전송 fallback
                    showToast(`📨 상담 신청서를 담당자(8470005@naver.com)에게 전송합니다.`);
                    insuranceForm.submit();
                }
            } catch (err) {
                console.warn('AJAX 메일 전송 오류, 기본 전송으로 대체합니다:', err);
                insuranceForm.submit();
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                }
            }
        });
    }
});

// 약관 상세 접기/펼치기 토글
window.togglePrivacyDetail = function() {
    const box = document.getElementById('privacy-detail-box');
    const txt = document.getElementById('privacy-toggle-text');
    if (!box || !txt) return;

    if (box.style.display === 'none') {
        box.style.display = 'block';
        txt.textContent = '약관 접기 ▴';
    } else {
        box.style.display = 'none';
        txt.textContent = '약관 펼치기 ▾';
    }
};

// 6. 차수별 상세 내역 보기 토글
window.toggleScheduleTable = function() {
    const box = document.getElementById('schedule-table-box');
    const btn = document.getElementById('btn-toggle-schedule');
    if (!box || !btn) return;

    if (box.style.display === 'none' || box.style.display === '') {
        box.style.display = 'block';
        btn.classList.add('active');
        btn.querySelector('span').textContent = '연부연납 차수별 상세 내역 닫기';
    } else {
        box.style.display = 'none';
        btn.classList.remove('active');
        btn.querySelector('span').textContent = '연부연납 차수별 상세 내역 보기';
    }
};

// 7. 모의 견적 상담 폼으로 자동 입력 및 스크롤
window.requestWithCalc = function() {
    const calcAmount = document.getElementById('calc-amount');
    const calcType = document.getElementById('calc-tax-type');
    const calcMonths = document.getElementById('calc-months');
    const resultPremium = document.getElementById('result-premium');
    const targetAmountInput = document.getElementById('target-amount');
    const consultTypeSelect = document.getElementById('consult-type');
    const clientMemo = document.getElementById('client-memo');
    const consultSection = document.getElementById('consultation');

    const cleanNum = calcAmount?.value.replace(/[^0-9]/g, '');
    const amount = Number(cleanNum) || 0;
    const years = Number(calcMonths?.value) || 1;
    const premiumText = resultPremium ? resultPremium.textContent : '0 원';

    // 금액 입력 (천단위 쉼표 포맷)
    if (targetAmountInput && amount > 0) {
        targetAmountInput.value = `${amount.toLocaleString('ko-KR')} 원`;
    }

    // 보증 종목 연동
    let typeName = '증여세 연부연납';
    if (calcType && consultTypeSelect) {
        if (calcType.value === 'inheritance') {
            consultTypeSelect.value = '상속세 연부연납 납세보증';
            typeName = '상속세 연부연납';
        } else {
            consultTypeSelect.value = '증여세 연부연납 납세보증';
            typeName = '증여세 연부연납';
        }
    }

    // 상담 메모에 견적 상세정보 입력
    if (clientMemo) {
        const addRateStr = (TAX_INSURANCE_CONFIG.ADDITIONAL_TAX_RATE * 100).toFixed(2) + '%';
        const insRateStr = (TAX_INSURANCE_CONFIG.INSURANCE_RATE * 100).toFixed(3) + '%';

        clientMemo.value = `[모의 계산 견적 정보]\n• 보증 종목: ${typeName} 납세보증\n• 대상 세액: ${targetAmountInput ? targetAmountInput.value : amount.toLocaleString() + '원'}\n• 분납 기간: ${years}년 (${years}회 분납)\n• 적용 기준: 가산세율 ${addRateStr}, 보험요율 ${insRateStr} (담보 110%)\n• 총 예상 보증보험료: ${premiumText}\n\n[문의 및 심사 요청 사항]\n`;
    }

    // 상담 폼 위치로 스크롤 이동
    if (consultSection) {
        consultSection.scrollIntoView({ behavior: 'smooth' });
        showToast('📝 엑셀 모의 견적 정보가 상담 폼에 자동 입력되었습니다.');
    }
};

// 8. 연락처/주소 클립보드 복사 함수
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

// 9. 공통 토스트 알림 팝업
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
