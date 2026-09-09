export const PHOTO_LIMIT = 30;
export const PHOTO_BYTES = 20 * 1024 * 1024;
const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function photoRejection(file, existing) {
  if (!supportedTypes.has(file.type)) return 'JPG, PNG, WebP 사진만 첨부할 수 있어요.';
  if (!file.size || file.size > PHOTO_BYTES) return '사진은 장당 20MB 이하의 파일을 선택해주세요.';
  if (existing.some((item) => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) return '이미 추가한 사진은 중복 첨부하지 않았어요.';
  if (existing.length >= PHOTO_LIMIT) return '사진은 최대 30장까지 첨부할 수 있어요.';
  return '';
}

export function mountPhotos(form, { pool = [], category = 'vehicle' } = {}) {
  const photos = pool;
  const input = form.querySelector('[data-photo-input]');
  const grid = form.querySelector('[data-photo-grid]');
  const error = form.querySelector('[data-photo-error]');
  const drop = form.querySelector('[data-drop]');
  let queue = Promise.resolve();
  let processing = false;

  function render() {
    grid.replaceChildren(...photos.filter(item => item.category === category).map((item, index) => {
      const figure = document.createElement('figure');
      const img = document.createElement('img');
      img.src = item.url; img.alt = `첨부 사진 ${index + 1}: ${item.file.name}`;
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = '×';
      button.setAttribute('aria-label', `${index + 1}번 사진 삭제`);
      button.addEventListener('click', () => {
        const position = photos.indexOf(item);
        if (position < 0) return;
        URL.revokeObjectURL(item.url); photos.splice(position, 1); render();form.dispatchEvent(new Event('attachments-changed',{bubbles:true}));
        (grid.querySelector('button') ?? input).focus();
      });
      const caption = document.createElement('figcaption');
      caption.textContent = `${index + 1}. ${item.file.name}`;
      figure.append(img, button, caption); return figure;
    }));
    form.querySelector('[data-photo-count]').textContent = `${photos.filter(item => item.category === category).length}장 · 전체 ${photos.length} / ${PHOTO_LIMIT}`;
  }

  async function add(files) {
    processing = true;
    error.textContent = '사진을 확인하고 있어요…';
    const messages = new Set();
    try {
      for (const file of files) {
        const rejection = photoRejection(file, photos);
        if (rejection) { messages.add(rejection); continue; }
        const url = URL.createObjectURL(file);
        const image = new Image(); image.src = url;
        try { await image.decode(); const finalCheck = photoRejection(file, photos); if (finalCheck) { URL.revokeObjectURL(url); messages.add(finalCheck); } else photos.push({ file, url, category }); }
        catch { URL.revokeObjectURL(url); messages.add('읽을 수 없는 사진은 제외했어요. 다른 사진을 선택해주세요.'); }
      }
      render(); error.textContent = [...messages].join(' ');form.dispatchEvent(new Event('attachments-changed',{bubbles:true}));
    } finally { processing = false; }
  }

  function enqueue(files) {
    const batch = Array.from(files);
    queue = queue.then(() => add(batch));
  }
  input.addEventListener('change', () => { enqueue(input.files); input.value = ''; });
  drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('is-dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault(); drop.classList.remove('is-dragging'); enqueue(event.dataTransfer.files);
  });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) photos.forEach((item) => URL.revokeObjectURL(item.url));
  });
  return { get photos() { return photos.filter(item => item.category === category); }, render, get processing() { return processing; }, ready: () => queue };
}
