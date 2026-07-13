/**
 * TalentHub — Dummy Hiring Platform
 * Frontend JavaScript: job listings, application modal, resume upload
 */

const API_BASE = window.location.origin; // http://localhost:8001

// ── State ─────────────────────────────────────────────────────────────────────
let jobs = [];
let selectedJob = null;
let selectedFile = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadJobs();
  loadStats();
  setupDropZone();
  setupForm();

  // Close modal on overlay click
  document.getElementById('apply-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // ESC to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
});

// ── Load Jobs ─────────────────────────────────────────────────────────────────
async function loadJobs() {
  const container = document.getElementById('jobs-container');
  const countBadge = document.getElementById('jobs-count');

  try {
    const res = await fetch(`${API_BASE}/jobs`);
    if (!res.ok) throw new Error('Failed to fetch jobs');
    const data = await res.json();
    jobs = data.jobs || [];

    countBadge.textContent = `${jobs.length} open`;
    document.getElementById('stat-jobs').textContent = jobs.length;

    if (jobs.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">📭</div>
          <p class="empty-text">No open positions right now.<br/>Check back soon or start a chat with the AI Hiring Bot.</p>
        </div>`;
      return;
    }

    container.innerHTML = jobs.map((job, i) => renderJobCard(job, i)).join('');

  } catch (err) {
    console.error('[TalentHub] Jobs fetch error:', err);
    countBadge.textContent = '—';

    // Render default jobs as fallback
    const fallback = getDefaultJobs();
    jobs = fallback;
    container.innerHTML = fallback.map((job, i) => renderJobCard(job, i)).join('');
    document.getElementById('stat-jobs').textContent = fallback.length;
    countBadge.textContent = `${fallback.length} open`;
  }
}

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/candidates`);
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('stat-candidates').textContent = data.total || 0;
  } catch {
    document.getElementById('stat-candidates').textContent = '—';
  }
}

// ── Render Job Card ───────────────────────────────────────────────────────────
function renderJobCard(job, index) {
  const icons = ['💻', '🎨', '📊', '🔧', '🧠', '⚡', '🌐', '🔐'];
  const icon = icons[index % icons.length];

  const skills = (job.skills || []).slice(0, 4);
  const skillsHtml = skills.map(s =>
    `<span class="skill-tag">${escHtml(s)}</span>`
  ).join('');

  return `
    <article class="job-card" id="job-card-${escHtml(job.id)}" onclick="openModal('${escAttr(job.id)}')">
      <div class="job-card-header">
        <div class="job-icon" aria-hidden="true">${icon}</div>
        <div class="job-card-title-group">
          <h3 class="job-title" title="${escAttr(job.title)}">${escHtml(job.title)}</h3>
          <p class="job-dept">${escHtml(job.department || 'Engineering')}</p>
        </div>
        <span class="job-status-badge">${escHtml(job.status || 'Open')}</span>
      </div>

      <div class="job-meta">
        <span class="job-meta-item">
          <span class="icon" aria-hidden="true">📍</span>
          ${escHtml(job.location || 'Remote')}
        </span>
        <span class="job-meta-item">
          <span class="icon" aria-hidden="true">⏱️</span>
          ${escHtml(job.experience || 'Not specified')}
        </span>
      </div>

      ${skillsHtml ? `<div class="job-skills">${skillsHtml}</div>` : ''}

      <div class="job-card-footer">
        <span class="salary-badge">${escHtml(job.salary || 'Competitive')}</span>
        <button
          class="btn-apply"
          onclick="event.stopPropagation(); openModal('${escAttr(job.id)}')"
          aria-label="Apply for ${escAttr(job.title)}"
        >
          Apply Now →
        </button>
      </div>
    </article>
  `;
}

function getDefaultJobs() {
  return [
    {
      id: 'job-001',
      title: 'Senior Python Developer',
      department: 'Engineering',
      location: 'Remote / Bangalore',
      experience: '4–6 years',
      salary: '₹20–30 LPA',
      skills: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
      status: 'Open',
    },
    {
      id: 'job-002',
      title: 'React Frontend Engineer',
      department: 'Engineering',
      location: 'Hybrid / Mumbai',
      experience: '3–5 years',
      salary: '₹15–25 LPA',
      skills: ['React', 'TypeScript', 'Tailwind CSS', 'GraphQL'],
      status: 'Open',
    },
    {
      id: 'job-003',
      title: 'ML / AI Engineer',
      department: 'AI Research',
      location: 'Remote',
      experience: '3–7 years',
      salary: '₹25–40 LPA',
      skills: ['Python', 'PyTorch', 'LangChain', 'Transformers'],
      status: 'Open',
    },
  ];
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(jobId) {
  const modal = document.getElementById('apply-modal');
  const formView = document.getElementById('form-view');
  const successView = document.getElementById('success-view');

  // Reset to form view
  formView.style.display = '';
  successView.classList.remove('show');
  document.getElementById('apply-form').reset();
  removeFile();

  if (jobId) {
    selectedJob = jobs.find(j => j.id === jobId) || null;
  } else {
    selectedJob = jobs[0] || null;
  }

  if (selectedJob) {
    document.getElementById('modal-job-name').textContent =
      `Applying for: ${selectedJob.title} — ${selectedJob.location}`;
    document.getElementById('field-job-id').value = selectedJob.id;
    document.getElementById('field-job-title').value = selectedJob.title;
  } else {
    document.getElementById('modal-job-name').textContent = 'General Application';
    document.getElementById('field-job-id').value = '';
    document.getElementById('field-job-title').value = '';
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Focus first input
  setTimeout(() => {
    document.getElementById('field-name')?.focus();
  }, 100);
}

function closeModal() {
  const modal = document.getElementById('apply-modal');
  modal.classList.remove('open');
  document.body.style.overflow = '';
  selectedJob = null;
}

// ── Navigation ────────────────────────────────────────────────────────────────
function scrollToJobs() {
  document.getElementById('jobs-section').scrollIntoView({ behavior: 'smooth' });
}

function scrollToAbout() {
  document.getElementById('about-section').scrollIntoView({ behavior: 'smooth' });
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────
function setupDropZone() {
  const zone = document.getElementById('drop-zone');

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (file) setFile(file);
}

function setFile(file) {
  const allowedTypes = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const allowedExts = ['.pdf', '.doc', '.docx'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();

  if (!allowedExts.includes(ext)) {
    showToast('error', '⚠️ Only PDF and Word documents are accepted.');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast('error', '⚠️ File must be under 10 MB.');
    return;
  }

  selectedFile = file;

  const sizeKB = (file.size / 1024).toFixed(1);
  const icon = ext === '.pdf' ? '📕' : '📘';

  document.getElementById('preview-icon').textContent = icon;
  document.getElementById('preview-name').textContent = file.name;
  document.getElementById('preview-size').textContent = `${sizeKB} KB`;
  document.getElementById('file-preview').classList.add('show');
  document.getElementById('drop-zone').classList.add('file-selected');

  validateForm();
}

function removeFile() {
  selectedFile = null;
  document.getElementById('resume-input').value = '';
  document.getElementById('file-preview').classList.remove('show');
  document.getElementById('drop-zone').classList.remove('file-selected');
  validateForm();
}

// ── Form Validation ───────────────────────────────────────────────────────────
function validateForm() {
  const name  = document.getElementById('field-name').value.trim();
  const email = document.getElementById('field-email').value.trim();
  const valid = name.length > 0 && email.includes('@') && selectedFile != null;
  document.getElementById('submit-btn').disabled = !valid;
}

function setupForm() {
  const form = document.getElementById('apply-form');

  ['field-name', 'field-email'].forEach(id => {
    document.getElementById(id).addEventListener('input', validateForm);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitApplication();
  });
}

// ── Submit Application ────────────────────────────────────────────────────────
async function submitApplication() {
  const btn = document.getElementById('submit-btn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('name',         document.getElementById('field-name').value.trim());
    formData.append('email',        document.getElementById('field-email').value.trim());
    formData.append('phone',        document.getElementById('field-phone').value.trim());
    formData.append('job_id',       document.getElementById('field-job-id').value);
    formData.append('job_title',    document.getElementById('field-job-title').value);
    formData.append('linkedin_url', document.getElementById('field-linkedin').value.trim());
    formData.append('cover_note',   document.getElementById('field-cover').value.trim());
    formData.append('resume',       selectedFile);

    const res = await fetch(`${API_BASE}/apply`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const data = await res.json();

    // Show success panel
    document.getElementById('form-view').style.display = 'none';
    document.getElementById('success-candidate-id').textContent =
      `Application ID: ${data.candidate_id}`;
    document.getElementById('success-view').classList.add('show');

    // Refresh stats
    loadStats();

  } catch (err) {
    console.error('[TalentHub] Submit error:', err);
    showToast('error', `❌ ${err.message}`);
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;

function showToast(type, message) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = message;
  toast.className = `toast ${type} show`;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
