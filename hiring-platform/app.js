/**
 * HireBoard v3
 * - Companies listed with their jobs grouped underneath
 * - Add / Edit Company modal
 * - Apply for Job modal with resume upload
 * - Jobs auto-posted by AI chatbot appear instantly
 */

const API_BASE = window.location.origin; // http://localhost:8001

// ── State ─────────────────────────────────────────────────────────────────────
let companies   = [];
let jobs        = [];
let selectedJob = null;
let selectedFile = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  setupDropZone();
  setupApplyForm();
  setupCompanyForm();

  // Close modals on overlay click
  document.getElementById('apply-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('company-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCompanyModal();
  });

  // ESC closes any open modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeCompanyModal(); }
  });

  // Keyboard support for company accordion headers (Enter / Space)
  document.getElementById('companies-container').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const header = e.target.closest('.company-header');
      if (header) {
        e.preventDefault();
        const section = header.closest('.company-section');
        if (section) toggleCompany(section.id.replace('company-section-', ''));
      }
    }
  });
});

// ── Load Everything ───────────────────────────────────────────────────────────
async function loadAll() {
  try {
    const [companiesRes, jobsRes] = await Promise.all([
      fetch(`${API_BASE}/companies`),
      fetch(`${API_BASE}/jobs`),
    ]);
    if (companiesRes.ok) {
      const d = await companiesRes.json();
      companies = d.companies || [];
    }
    if (jobsRes.ok) {
      const d = await jobsRes.json();
      jobs = d.jobs || [];
    }
  } catch (err) {
    console.warn('[HireBoard] Using fallback data:', err);
    companies = getDefaultCompanies();
    jobs      = getDefaultJobs();
  }

  // Ensure we always have at least one company
  if (companies.length === 0) companies = getDefaultCompanies();

  renderAll();
}

// ── Render All Companies + their Jobs ────────────────────────────────────────
function renderAll() {
  const container = document.getElementById('companies-container');

  if (companies.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏢</div>
        <div class="empty-title">No companies yet</div>
        <div class="empty-sub">Click "+ Add Company" in the header to create your first company.</div>
      </div>`;
    return;
  }

  container.innerHTML = companies.map((company, idx) => renderCompanySection(company, idx)).join('');
}

function renderCompanySection(company, idx) {
  const companyJobs = jobs.filter(j => j.company_id === company.id);
  const initials    = getInitials(company.name);
  const openCount   = companyJobs.filter(j => (j.status || 'open').toLowerCase() === 'open').length;

  // Start expanded if this company has jobs, collapsed if it has none
  const startCollapsed = companyJobs.length === 0;

  const jobsHtml = companyJobs.length > 0
    ? `<div class="company-jobs-list">${companyJobs.map((job, i) => renderJobRow(job, i)).join('')}</div>`
    : `<div class="company-jobs-list">
         <div class="company-jobs-empty">
           📭 No open positions for this company yet. Jobs are created when the recruiter approves a JD in the chatbot.
         </div>
       </div>`;

  const chevron = `
    <div class="company-chevron" aria-label="Toggle jobs">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`;

  return `
    <div class="company-section ${startCollapsed ? 'collapsed' : ''}" id="company-section-${escHtml(company.id)}">
      <div class="company-header" onclick="toggleCompany('${escAttr(company.id)}')" role="button" aria-expanded="${!startCollapsed}" tabindex="0">
        <div class="company-left">
          <div class="company-avatar">${escHtml(initials)}</div>
          <div>
            <div class="company-name">
              ${escHtml(company.name)}
              <span class="company-jobs-count">${openCount} open</span>
            </div>
            <div class="company-tagline">${escHtml(company.tagline || '')}</div>
          </div>
        </div>

        <div class="company-right">
          <div class="company-meta-list">
            ${company.industry ? `
              <div class="meta-item">
                <span class="meta-label">Industry</span>
                <span class="meta-value">${escHtml(company.industry)}</span>
              </div>` : ''}
            ${company.location ? `
              <div class="meta-item">
                <span class="meta-label">Location</span>
                <span class="meta-value">${escHtml(company.location)}</span>
              </div>` : ''}
            ${company.team_size ? `
              <div class="meta-item">
                <span class="meta-label">Team Size</span>
                <span class="meta-value">${escHtml(company.team_size)}</span>
              </div>` : ''}
          </div>
          <button class="btn-edit-company" onclick="event.stopPropagation(); openCompanyModal('${escAttr(company.id)}')">
            Edit
          </button>
          ${chevron}
        </div>
      </div>

      ${jobsHtml}
    </div>`;
}

// ── Render Job Row ────────────────────────────────────────────────────────────
function renderJobRow(job, index) {
  const icons  = ['💻', '🎨', '📊', '🔧', '🧠', '⚡', '🌐', '🔐', '📱', '🔬'];
  const icon   = icons[index % icons.length];
  const skills = (job.skills || []).slice(0, 5);
  const status = (job.status || 'open').toLowerCase();

  const skillsHtml = skills.map(s =>
    `<span class="skill-tag">${escHtml(s)}</span>`
  ).join('');

  return `
    <div class="job-card" id="job-card-${escHtml(job.id)}">
      <div class="job-icon" aria-hidden="true">${icon}</div>

      <div class="job-main">
        <div class="job-title">${escHtml(job.title)}</div>
        <div class="job-chips">
          <span class="chip"><span class="chip-icon">📍</span>${escHtml(job.location || 'Remote')}</span>
          <span class="chip"><span class="chip-icon">⏱</span>${escHtml(job.experience || 'Any')}</span>
          <span class="chip"><span class="chip-icon">🏢</span>${escHtml(job.department || 'Engineering')}</span>
        </div>
        ${skillsHtml ? `<div class="skill-tags">${skillsHtml}</div>` : ''}
      </div>

      <div class="job-right">
        <span class="job-salary">${escHtml(job.salary || 'Competitive')}</span>
        <span class="status-badge">${escHtml(status)}</span>
        <button
          class="btn-apply"
          onclick="openModal('${escAttr(job.id)}')"
          aria-label="Apply for ${escAttr(job.title)}"
        >Apply Now</button>
      </div>
    </div>`;
}

// ── Default Fallback Data ─────────────────────────────────────────────────────
function getDefaultCompanies() {
  return [{
    id:        'company-001',
    name:      'TechCorp Inc.',
    tagline:   'Building the future, one hire at a time',
    industry:  'Technology',
    location:  'Bangalore, India',
    team_size: '50–200',
  }];
}

function getDefaultJobs() {
  return [
    {
      id: 'job-001', company_id: 'company-001',
      title: 'Senior Python Developer', department: 'Engineering',
      location: 'Remote / Bangalore', experience: '4–6 years',
      salary: '₹20–30 LPA', skills: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'], status: 'open',
    },
    {
      id: 'job-002', company_id: 'company-001',
      title: 'React Frontend Engineer', department: 'Engineering',
      location: 'Hybrid / Mumbai', experience: '3–5 years',
      salary: '₹15–25 LPA', skills: ['React', 'TypeScript', 'Tailwind CSS', 'GraphQL'], status: 'open',
    },
  ];
}

// ── Company Accordion Toggle ──────────────────────────────────────────────────
function toggleCompany(companyId) {
  const section = document.getElementById(`company-section-${companyId}`);
  if (!section) return;

  const isCollapsed = section.classList.contains('collapsed');
  section.classList.toggle('collapsed', !isCollapsed);

  // Update aria-expanded on the header
  const header = section.querySelector('.company-header');
  if (header) header.setAttribute('aria-expanded', String(isCollapsed));
}

// ── Company Modal ─────────────────────────────────────────────────────────────
function openCompanyModal(companyId) {
  const modal  = document.getElementById('company-modal');
  const form   = document.getElementById('company-form');
  const heading = document.getElementById('company-modal-heading');

  form.reset();

  if (companyId) {
    // Edit mode
    const co = companies.find(c => c.id === companyId);
    if (!co) return;

    heading.textContent = 'Edit Company';
    document.getElementById('editing-company-id').value = co.id;
    document.getElementById('co-name').value      = co.name      || '';
    document.getElementById('co-tagline').value   = co.tagline   || '';
    document.getElementById('co-industry').value  = co.industry  || '';
    document.getElementById('co-location').value  = co.location  || '';
    document.getElementById('co-team-size').value = co.team_size || '';
    document.getElementById('co-website').value   = co.website   || '';
  } else {
    // Create mode
    heading.textContent = 'Add Company';
    document.getElementById('editing-company-id').value = '';
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('co-name')?.focus(), 100);
}

function closeCompanyModal() {
  document.getElementById('company-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function setupCompanyForm() {
  document.getElementById('company-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveCompany();
  });
}

async function saveCompany() {
  const btn       = document.getElementById('company-submit-btn');
  const editingId = document.getElementById('editing-company-id').value.trim();

  const payload = {
    name:      document.getElementById('co-name').value.trim(),
    tagline:   document.getElementById('co-tagline').value.trim(),
    industry:  document.getElementById('co-industry').value.trim(),
    location:  document.getElementById('co-location').value.trim(),
    team_size: document.getElementById('co-team-size').value.trim(),
    website:   document.getElementById('co-website').value.trim(),
  };

  if (!payload.name) {
    showToast('error', 'Company name is required.');
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    let res;
    if (editingId) {
      res = await fetch(`${API_BASE}/companies/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`${API_BASE}/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    const saved = data.company;

    if (editingId) {
      const idx = companies.findIndex(c => c.id === editingId);
      if (idx !== -1) companies[idx] = saved;
      showToast('success', `${saved.name} updated.`);
    } else {
      companies.push(saved);
      showToast('success', `${saved.name} added!`);
    }

    closeCompanyModal();
    renderAll();
  } catch (err) {
    console.error('[HireBoard] Save company error:', err);
    showToast('error', err.message || 'Failed to save company.');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ── Apply Modal ───────────────────────────────────────────────────────────────
function openModal(jobId) {
  const modal       = document.getElementById('apply-modal');
  const formView    = document.getElementById('form-view');
  const successView = document.getElementById('success-view');

  formView.style.display = '';
  successView.style.display = 'none';
  document.getElementById('apply-form').reset();
  removeFile();

  selectedJob = jobId ? jobs.find(j => j.id === jobId) || null : jobs[0] || null;

  if (selectedJob) {
    document.getElementById('modal-job-label').textContent =
      `${selectedJob.title} — ${selectedJob.location || ''}`;
    document.getElementById('field-job-id').value    = selectedJob.id;
    document.getElementById('field-job-title').value = selectedJob.title;
    document.getElementById('field-company-id').value = selectedJob.company_id || '';
  } else {
    document.getElementById('modal-job-label').textContent = 'General Application';
    document.getElementById('field-job-id').value    = '';
    document.getElementById('field-job-title').value = '';
    document.getElementById('field-company-id').value = '';
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('field-name')?.focus(), 100);
}

function closeModal() {
  document.getElementById('apply-modal').classList.remove('open');
  document.body.style.overflow = '';
  selectedJob = null;
}

function scrollToJobs() {
  document.getElementById('companies').scrollIntoView({ behavior: 'smooth' });
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────
function setupDropZone() {
  const zone = document.getElementById('drop-zone');

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
}

function handleFileSelect(input) {
  if (input.files[0]) setFile(input.files[0]);
}

function setFile(file) {
  const allowedExts = ['.pdf', '.doc', '.docx'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();

  if (!allowedExts.includes(ext)) {
    showToast('error', 'Only PDF and Word documents are accepted.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('error', 'File must be under 10 MB.');
    return;
  }

  selectedFile = file;
  const sizeKB = (file.size / 1024).toFixed(1);
  document.getElementById('preview-icon').textContent = ext === '.pdf' ? '📕' : '📘';
  document.getElementById('preview-name').textContent = file.name;
  document.getElementById('preview-size').textContent = `${sizeKB} KB`;
  document.getElementById('file-preview').style.display = 'flex';
  document.getElementById('drop-zone').classList.add('file-selected');
  validateForm();
}

function removeFile() {
  selectedFile = null;
  const input = document.getElementById('resume-input');
  if (input) input.value = '';
  document.getElementById('file-preview').style.display = 'none';
  document.getElementById('drop-zone')?.classList.remove('file-selected');
  validateForm();
}

// ── Form Validation ───────────────────────────────────────────────────────────
function validateForm() {
  const name  = document.getElementById('field-name')?.value.trim() || '';
  const email = document.getElementById('field-email')?.value.trim() || '';
  const valid = name.length > 0 && email.includes('@') && selectedFile != null;
  const btn   = document.getElementById('submit-btn');
  if (btn) btn.disabled = !valid;
}

function setupApplyForm() {
  ['field-name', 'field-email'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', validateForm);
  });

  document.getElementById('apply-form').addEventListener('submit', async (e) => {
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
    const fd = new FormData();
    fd.append('name',         document.getElementById('field-name').value.trim());
    fd.append('email',        document.getElementById('field-email').value.trim());
    fd.append('phone',        document.getElementById('field-phone').value.trim());
    fd.append('job_id',       document.getElementById('field-job-id').value);
    fd.append('job_title',    document.getElementById('field-job-title').value);
    fd.append('company_id',   document.getElementById('field-company-id').value);
    fd.append('linkedin_url', document.getElementById('field-linkedin').value.trim());
    fd.append('cover_note',   document.getElementById('field-cover').value.trim());
    fd.append('resume',       selectedFile);

    const res = await fetch(`${API_BASE}/apply`, { method: 'POST', body: fd });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const data = await res.json();

    // Show success
    document.getElementById('form-view').style.display = 'none';
    document.getElementById('success-id').textContent = `Application ID: ${data.candidate_id}`;
    document.getElementById('success-view').style.display = 'block';

  } catch (err) {
    console.error('[HireBoard] Submit error:', err);
    showToast('error', err.message || 'Submission failed. Please try again.');
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
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

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
