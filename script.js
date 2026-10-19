// DOM 요소 참조
const memoForm = document.getElementById('memo-form');
const titleInput = document.getElementById('memo-title');
const contentInput = document.getElementById('memo-content');
const editMemoId = document.getElementById('edit-memo-id');
const editBadge = document.getElementById('edit-badge');
const btnSubmitText = document.getElementById('btn-submit-text');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const btnReset = document.getElementById('btn-reset');
const memoItemsContainer = document.getElementById('memo-items');
const memoCount = document.getElementById('memo-count');
const toast = document.getElementById('toast');

const STORAGE_KEY = 'simple_memos_data';
let toastTimeout = null;

// 토스트 알림 함수
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// 로컬스토리지에서 메모 가져오기
function getMemos() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// 로컬스토리지에 메모 저장하기
function saveMemos(memos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

// 날짜 포맷팅 함수
function formatDate(dateString) {
    const date = new Date(dateString);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

// 메모 목록 렌더링
function renderMemos() {
    const memos = getMemos();
    memoCount.textContent = memos.length;

    if (memos.length === 0) {
        memoItemsContainer.innerHTML = `
            <div class="empty-state">
                아직 저장된 메모가 없습니다.<br>위에서 새로운 메모를 작성해보세요!
            </div>
        `;
        return;
    }

    memoItemsContainer.innerHTML = memos.map(memo => `
        <div class="memo-card" data-id="${memo.id}">
            <div class="card-top">
                <h3 class="card-title">${escapeHtml(memo.title)}</h3>
                <span class="card-date">${formatDate(memo.date)}</span>
            </div>
            <div class="card-content">${escapeHtml(memo.content)}</div>
            <div class="card-actions">
                <button type="button" class="action-btn" onclick="downloadMemo(${memo.id})">다운로드</button>
                <button type="button" class="action-btn" onclick="startEditMemo(${memo.id})">수정</button>
                <button type="button" class="action-btn delete-btn" onclick="deleteMemo(${memo.id})">삭제</button>
            </div>
        </div>
    `).join('');
}

// HTML 특수문자 이스케이프
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 폼 리셋 및 작성 모드로 복원
function resetForm() {
    memoForm.reset();
    editMemoId.value = '';
    editBadge.style.display = 'none';
    btnCancelEdit.style.display = 'none';
    btnSubmitText.textContent = '저장하기';
    titleInput.focus();
}

// 메모 제출(신규 등록 또는 수정) 처리
memoForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const targetId = editMemoId.value;

    if (!title || !content) {
        showToast('⚠️ 제목과 내용을 모두 입력해주세요.');
        return;
    }

    const memos = getMemos();

    if (targetId) {
        // 수정 모드
        const index = memos.findIndex(m => m.id == targetId);
        if (index !== -1) {
            memos[index].title = title;
            memos[index].content = content;
            memos[index].date = new Date().toISOString();
            saveMemos(memos);
            showToast('✏️ 메모가 수정되었습니다.');
        }
    } else {
        // 신규 등록
        const newMemo = {
            id: Date.now(),
            title,
            content,
            date: new Date().toISOString()
        };
        memos.unshift(newMemo);
        saveMemos(memos);
        showToast('✅ 메모가 저장되었습니다.');
    }

    resetForm();
    renderMemos();
});

// 초기화 버튼 클릭 이벤트
btnReset.addEventListener('click', () => {
    if (titleInput.value || contentInput.value) {
        resetForm();
        showToast('🧹 입력창이 초기화되었습니다.');
    } else {
        showToast('입력창이 이미 비어있습니다.');
    }
});

// 수정 취소 버튼 클릭 이벤트
btnCancelEdit.addEventListener('click', () => {
    resetForm();
    showToast('수정이 취소되었습니다.');
});

// 메모 수정 모드 시작
window.startEditMemo = function(id) {
    const memos = getMemos();
    const memo = memos.find(m => m.id === id);
    if (!memo) return;

    editMemoId.value = memo.id;
    titleInput.value = memo.title;
    contentInput.value = memo.content;

    editBadge.style.display = 'inline-block';
    btnCancelEdit.style.display = 'inline-flex';
    btnSubmitText.textContent = '수정 완료';

    window.scrollTo({ top: 0, behavior: 'smooth' });
    titleInput.focus();
    showToast('메모를 수정 중입니다.');
};

// 메모 삭제
window.deleteMemo = function(id) {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;

    let memos = getMemos();
    memos = memos.filter(m => m.id !== id);
    saveMemos(memos);

    // 삭제한 항목이 현재 수정 중이던 항목인 경우 폼 초기화
    if (editMemoId.value == id) {
        resetForm();
    }

    renderMemos();
    showToast('🗑️ 메모가 삭제되었습니다.');
};

// 텍스트(.txt) 파일로 메모 다운로드
window.downloadMemo = function(id) {
    const memos = getMemos();
    const memo = memos.find(m => m.id === id);
    if (!memo) return;

    const textContent = `제목: ${memo.title}\n작성일시: ${formatDate(memo.date)}\n\n${memo.content}`;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${memo.title.replace(/[\\/:*?"<>|]/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('📥 텍스트 파일로 다운로드되었습니다.');
};

// 초기 로드 시 기존 메모 표시
renderMemos();
