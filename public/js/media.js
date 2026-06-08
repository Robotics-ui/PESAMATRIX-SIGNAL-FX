let currentFilter = 'all';
let allMedia = [];

async function loadMedia() {
  const grid = document.getElementById('mediaGrid');
  grid.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  const res = await apiFetch('/api/media');
  if (!res.ok) { grid.innerHTML = '<div class="empty-state"><p>Failed to load media.</p></div>'; return; }

  allMedia = await res.json();
  renderGrid();

  const total = document.getElementById('statTotal');
  const images = document.getElementById('statImages');
  const videos = document.getElementById('statVideos');
  if (total) total.textContent = allMedia.length;
  if (images) images.textContent = allMedia.filter(m => m.category === 'image').length;
  if (videos) videos.textContent = allMedia.filter(m => m.category === 'video').length;
}

function renderGrid() {
  const grid = document.getElementById('mediaGrid');
  const filtered = currentFilter === 'all' ? allMedia : allMedia.filter(m => m.category === currentFilter);

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🖼</div>
        <div class="empty-title">No media files yet</div>
        <div class="empty-desc">Upload images or videos using the zone above.</div>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(m => `
    <div class="media-item" data-id="${m.id}">
      ${m.category === 'image'
        ? `<img class="media-thumb" src="${m.url}" alt="${escHtml(m.originalName)}" loading="lazy">`
        : `<div class="media-video-thumb">▶</div>`}
      <div class="media-info">
        <div class="media-name" title="${escHtml(m.originalName)}">${escHtml(m.originalName)}</div>
        <div class="media-meta">
          <span class="badge ${m.category === 'image' ? 'badge-blue' : 'badge-green'}" style="font-size:10px">${m.category}</span>
          <span>${formatBytes(m.size)}</span>
        </div>
        ${m.description ? `<div class="media-name" style="margin-top:4px;color:var(--text-muted);font-size:11px">${escHtml(m.description)}</div>` : ''}
      </div>
      <div class="media-actions">
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteMedia('${m.id}')" title="Delete">🗑</button>
      </div>
    </div>
  `).join('');
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === f));
  renderGrid();
}

async function deleteMedia(id) {
  if (!confirm('Delete this file? This cannot be undone.')) return;
  const res = await apiFetch(`/api/media/${id}`, { method: 'DELETE' });
  if (res.ok) {
    allMedia = allMedia.filter(m => m.id !== id);
    renderGrid();
    showAlert('alertBox', 'success', 'File deleted.');
  } else {
    const data = await res.json();
    showAlert('alertBox', 'error', data.error || 'Delete failed.');
  }
}

function initUploadZone() {
  const zone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const progress = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('uploadProgressBar');
  const uploadBtn = document.getElementById('uploadBtn');

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragging');
    const files = e.dataTransfer.files;
    if (files.length) handleUpload(files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleUpload(fileInput.files[0]);
  });

  if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());

  async function handleUpload(file) {
    const desc = document.getElementById('descInput')?.value?.trim() || '';
    const formData = new FormData();
    formData.append('file', file);
    if (desc) formData.append('description', desc);

    progress.style.display = 'block';
    progressBar.style.width = '30%';

    const token = getToken();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media/upload');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        progressBar.style.width = Math.round((e.loaded / e.total) * 90) + '%';
      }
    });

    xhr.onload = async () => {
      progressBar.style.width = '100%';
      setTimeout(() => { progress.style.display = 'none'; progressBar.style.width = '0%'; }, 800);
      if (xhr.status === 201) {
        const media = JSON.parse(xhr.responseText);
        allMedia.unshift(media);
        renderGrid();
        showAlert('alertBox', 'success', `"${file.name}" uploaded successfully.`);
        if (document.getElementById('descInput')) document.getElementById('descInput').value = '';
        fileInput.value = '';

        const total = document.getElementById('statTotal');
        const images = document.getElementById('statImages');
        const videos = document.getElementById('statVideos');
        if (total) total.textContent = allMedia.length;
        if (images) images.textContent = allMedia.filter(m => m.category === 'image').length;
        if (videos) videos.textContent = allMedia.filter(m => m.category === 'video').length;
      } else {
        const err = JSON.parse(xhr.responseText);
        showAlert('alertBox', 'error', err.error || 'Upload failed.');
      }
    };

    xhr.onerror = () => {
      progress.style.display = 'none';
      showAlert('alertBox', 'error', 'Upload failed — network error.');
    };

    xhr.send(formData);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initSidebar('media');
  initUploadZone();
  loadMedia();

  document.querySelectorAll('.filter-tab').forEach(t => {
    t.addEventListener('click', () => setFilter(t.dataset.filter));
  });
});
