const API_BASE = '';

let priceChart = null;
let providerChart = null;
let allModels = [];
let allProviders = [];

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initFilters();
    initModal();
    initSweepButton();
    initAddProvider();
    loadDashboard();
});

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            
            btn.classList.add('active');
            const view = btn.dataset.view;
            document.getElementById(`${view}-view`).classList.add('active');
            
            const titles = {
                dashboard: 'Dashboard',
                models: 'All Models',
                providers: 'Providers',
                history: 'Scrape History'
            };
            document.getElementById('page-title').textContent = titles[view] || 'Dashboard';
            
            if (view === 'models') loadModels();
            if (view === 'providers') loadProviders();
            if (view === 'history') loadHistory();
        });
    });
}

function initFilters() {
    document.getElementById('provider-filter').addEventListener('change', filterModels);
    document.getElementById('modality-filter').addEventListener('change', filterModels);
    document.getElementById('search-input').addEventListener('input', filterModels);
}

function initModal() {
    const modal = document.getElementById('model-modal');
    document.querySelector('.modal-close').addEventListener('click', () => {
        modal.classList.remove('active');
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
}

function initSweepButton() {
    document.getElementById('trigger-sweep').addEventListener('click', triggerSweep);
}

async function loadDashboard() {
    await Promise.all([loadStats(), loadModels(), loadProviders()]);
    renderCharts();
}

async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/api/stats`);
        const stats = await res.json();
        
        document.getElementById('stat-models').textContent = stats.total_models;
        document.getElementById('stat-providers').textContent = stats.total_providers;
        document.getElementById('stat-avg-price').textContent = stats.price_range.avg ? `$${stats.price_range.avg.toFixed(2)}` : '--';
        document.getElementById('stat-scrapes').textContent = stats.total_scrapes;
        
        if (stats.last_scrape) {
            const date = new Date(stats.last_scrape);
            document.getElementById('last-update').textContent = `Last update: ${date.toLocaleString()}`;
        }
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

async function loadModels() {
    try {
        const res = await fetch(`${API_BASE}/api/models`);
        allModels = await res.json();
        renderModelsTable(allModels.slice(0, 10));
        renderModelsGrid(allModels);
        populateProviderFilter();
    } catch (err) {
        console.error('Failed to load models:', err);
    }
}

async function loadProviders() {
    try {
        const res = await fetch(`${API_BASE}/api/providers`);
        allProviders = await res.json();
        renderProvidersGrid(allProviders);
    } catch (err) {
        console.error('Failed to load providers:', err);
    }
}

async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/scrape-logs`);
        const logs = await res.json();
        renderLogsTable(logs);
    } catch (err) {
        console.error('Failed to load history:', err);
    }
}

function renderModelsTable(models) {
    const tbody = document.getElementById('models-table-body');
    
    if (!models.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No models found</td></tr>';
        return;
    }
    
    tbody.innerHTML = models.map(model => `
        <tr onclick="showModelDetails('${model.name}')" style="cursor:pointer">
            <td><strong>${model.display_name}</strong></td>
            <td>${model.provider_name}</td>
            <td><span class="status-badge status-${model.modality === 'multimodal' ? 'success' : 'partial'}">${model.modality}</span></td>
            <td>${model.input_price_per_million !== null ? `$${model.input_price_per_million.toFixed(2)}` : '--'}</td>
            <td>${model.output_price_per_million !== null ? `$${model.output_price_per_million.toFixed(2)}` : '--'}</td>
            <td>${model.last_updated ? new Date(model.last_updated).toLocaleDateString() : '--'}</td>
        </tr>
    `).join('');
}

function renderModelsGrid(models) {
    const grid = document.getElementById('models-grid');
    
    if (!models.length) {
        grid.innerHTML = '<div class="loading">No models found</div>';
        return;
    }
    
    grid.innerHTML = models.map(model => `
        <div class="model-card" onclick="showModelDetails('${model.name}')">
            <div class="model-card-header">
                <span class="model-name">${model.display_name}</span>
                <span class="model-provider">${model.provider_name}</span>
            </div>
            <div class="model-pricing">
                <div class="price-item">
                    <div class="price-label">Input</div>
                    <div class="price-value">
                        ${model.input_price_per_million !== null ? `$${model.input_price_per_million.toFixed(2)}` : '--'}
                        <span class="unit">/1M</span>
                    </div>
                </div>
                <div class="price-item">
                    <div class="price-label">Output</div>
                    <div class="price-value">
                        ${model.output_price_per_million !== null ? `$${model.output_price_per_million.toFixed(2)}` : '--'}
                        <span class="unit">/1M</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderProvidersGrid(providers) {
    const grid = document.getElementById('providers-grid');
    
    grid.innerHTML = providers.map(provider => `
        <div class="provider-card">
            <div class="provider-name">${provider.name}</div>
            <div class="provider-models">${provider.model_count} model${provider.model_count !== 1 ? 's' : ''}</div>
            ${provider.website ? `<a href="${provider.website}" target="_blank" class="provider-link">
                Visit website
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15,3 21,3 21,9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
            </a>` : ''}
            <div style="margin-top: 12px; font-size: 12px; color: var(--text-muted)">
                Last scraped: ${provider.last_scraped ? new Date(provider.last_scraped).toLocaleString() : 'Never'}
            </div>
        </div>
    `).join('');
}

function renderLogsTable(logs) {
    const tbody = document.getElementById('logs-table-body');
    
    if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No scrape logs found</td></tr>';
        return;
    }
    
    tbody.innerHTML = logs.map(log => `
        <tr>
            <td>${log.provider_name}</td>
            <td><span class="status-badge status-${log.status}">${log.status}</span></td>
            <td>${log.models_found}</td>
            <td>${log.duration_seconds ? `${log.duration_seconds.toFixed(1)}s` : '--'}</td>
            <td>${new Date(log.scraped_at).toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderCharts() {
    renderPriceChart();
    renderProviderChart();
}

function renderPriceChart() {
    const ctx = document.getElementById('price-chart');
    if (!ctx) return;
    
    if (priceChart) priceChart.destroy();
    
    const data = allModels
        .filter(m => m.input_price_per_million !== null)
        .sort((a, b) => a.input_price_per_million - b.input_price_per_million)
        .slice(0, 15);
    
    priceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(m => m.display_name),
            datasets: [{
                label: 'Input $/1M tokens',
                data: data.map(m => m.input_price_per_million),
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: '#6366f1',
                borderWidth: 1,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    ticks: { color: '#64748b', maxRotation: 45, font: { size: 11 } },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                },
                y: {
                    ticks: { color: '#64748b', callback: v => `$${v}` },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                }
            }
        }
    });
}

function renderProviderChart() {
    const ctx = document.getElementById('provider-chart');
    if (!ctx) return;
    
    if (providerChart) providerChart.destroy();
    
    const providerCounts = {};
    allModels.forEach(m => {
        providerCounts[m.provider_name] = (providerCounts[m.provider_name] || 0) + 1;
    });
    
    const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
    
    providerChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(providerCounts),
            datasets: [{
                data: Object.values(providerCounts),
                backgroundColor: colors.slice(0, Object.keys(providerCounts).length),
                borderWidth: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8', padding: 12, font: { size: 12 } }
                }
            },
            cutout: '60%',
        }
    });
}

function populateProviderFilter() {
    const select = document.getElementById('provider-filter');
    const providers = [...new Set(allModels.map(m => m.provider_name))].sort();
    
    select.innerHTML = '<option value="">All Providers</option>' + 
        providers.map(p => `<option value="${p}">${p}</option>`).join('');
}

function filterModels() {
    const provider = document.getElementById('provider-filter').value;
    const modality = document.getElementById('modality-filter').value;
    const search = document.getElementById('search-input').value.toLowerCase();
    
    let filtered = allModels;
    
    if (provider) filtered = filtered.filter(m => m.provider_name === provider);
    if (modality) filtered = filtered.filter(m => m.modality === modality);
    if (search) filtered = filtered.filter(m => 
        m.display_name.toLowerCase().includes(search) || 
        m.provider_name.toLowerCase().includes(search)
    );
    
    renderModelsTable(filtered.slice(0, 10));
    renderModelsGrid(filtered);
}

async function showModelDetails(modelName) {
    try {
        const res = await fetch(`${API_BASE}/api/pricing-history/${modelName}`);
        const data = await res.json();
        
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <h2>${data.model}</h2>
            <span class="provider-tag">${data.provider}</span>
            
            <div class="price-history-chart">
                <canvas id="modal-chart"></canvas>
            </div>
            
            ${data.history.length ? `
                <h4 style="margin-top: 24px; margin-bottom: 12px;">Recent Pricing</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Input $/1M</th>
                            <th>Output $/1M</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.history.slice(0, 10).map(h => `
                            <tr>
                                <td>${h.input_price !== null ? `$${h.input_price.toFixed(2)}` : '--'}</td>
                                <td>${h.output_price !== null ? `$${h.output_price.toFixed(2)}` : '--'}</td>
                                <td>${new Date(h.scraped_at).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="color: var(--text-muted); margin-top: 24px;">No pricing history yet. Run a sweep to collect data.</p>'}
        `;
        
        document.getElementById('model-modal').classList.add('active');
        
        if (data.history.length > 1) {
            const ctx = document.getElementById('modal-chart');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.history.map(h => new Date(h.scraped_at).toLocaleDateString()).reverse(),
                    datasets: [
                        {
                            label: 'Input $/1M',
                            data: data.history.map(h => h.input_price).reverse(),
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            tension: 0.3,
                            fill: true,
                        },
                        {
                            label: 'Output $/1M',
                            data: data.history.map(h => h.output_price).reverse(),
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            tension: 0.3,
                            fill: true,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { labels: { color: '#94a3b8' } }
                    },
                    scales: {
                        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        y: { ticks: { color: '#64748b', callback: v => `$${v}` }, grid: { color: 'rgba(255,255,255,0.05)' } }
                    }
                }
            });
        }
    } catch (err) {
        console.error('Failed to load model details:', err);
    }
}

async function triggerSweep() {
    const btn = document.getElementById('trigger-sweep');
    btn.classList.add('sweeping');
    btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Sweeping...
    `;
    
    try {
        const res = await fetch(`${API_BASE}/api/sweep`, { method: 'POST' });
        const result = await res.json();
        
        setTimeout(async () => {
            await loadDashboard();
            btn.classList.remove('sweeping');
            btn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23,4 23,10 17,10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Run Sweep
            `;
        }, 5000);
    } catch (err) {
        console.error('Sweep failed:', err);
        btn.classList.remove('sweeping');
        btn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23,4 23,10 17,10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Run Sweep
        `;
    }
}

function initAddProvider() {
    const modal = document.getElementById('add-provider-modal');
    const openBtn = document.getElementById('add-provider-btn');
    const closeBtn = document.getElementById('close-add-provider');
    const cancelBtn = document.getElementById('cancel-add-provider');
    const addUrlBtn = document.getElementById('add-url-btn');
    const form = document.getElementById('add-provider-form');

    openBtn.addEventListener('click', () => {
        resetAddProviderForm();
        modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    addUrlBtn.addEventListener('click', addUrlInput);

    form.addEventListener('submit', handleAddProvider);

    document.getElementById('provider-name').addEventListener('input', validateForm);
    document.getElementById('provider-website').addEventListener('input', validateForm);
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('pricing-url-input')) validateForm();
    }, true);
}

function resetAddProviderForm() {
    document.getElementById('add-provider-form').reset();
    const container = document.getElementById('pricing-urls-container');
    container.innerHTML = `
        <div class="url-input-row">
            <input type="url" class="pricing-url-input" placeholder="https://example.com/pricing" required>
            <button type="button" class="remove-url-btn" title="Remove URL">&times;</button>
        </div>
    `;
    container.querySelector('.remove-url-btn').addEventListener('click', function() {
        this.parentElement.remove();
        validateForm();
    });
    document.getElementById('verification-results').style.display = 'none';
    document.getElementById('save-provider-btn').disabled = true;
    clearFieldErrors();
}

function addUrlInput() {
    const container = document.getElementById('pricing-urls-container');
    const row = document.createElement('div');
    row.className = 'url-input-row';
    row.innerHTML = `
        <input type="url" class="pricing-url-input" placeholder="https://example.com/pricing" required>
        <button type="button" class="remove-url-btn" title="Remove URL">&times;</button>
    `;
    container.appendChild(row);
    row.querySelector('.remove-url-btn').addEventListener('click', function() {
        this.parentElement.remove();
        validateForm();
    });
    row.querySelector('input').focus();
}

function clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-group input').forEach(el => el.classList.remove('invalid'));
}

function validateForm() {
    const name = document.getElementById('provider-name').value.trim();
    const website = document.getElementById('provider-website').value.trim();
    const urls = Array.from(document.querySelectorAll('.pricing-url-input'))
        .map(i => i.value.trim())
        .filter(u => u.length > 0);

    const saveBtn = document.getElementById('save-provider-btn');
    saveBtn.disabled = !(name && isValidUrl(website) && urls.length > 0 && urls.every(isValidUrl));
}

function isValidUrl(str) {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

async function handleAddProvider(e) {
    e.preventDefault();
    clearFieldErrors();

    const name = document.getElementById('provider-name').value.trim();
    const website = document.getElementById('provider-website').value.trim();
    const urls = Array.from(document.querySelectorAll('.pricing-url-input'))
        .map(i => i.value.trim())
        .filter(u => u.length > 0);

    let hasError = false;

    if (!name) {
        showFieldError('name-error', 'provider-name', 'Provider name is required');
        hasError = true;
    }
    if (!website) {
        showFieldError('website-error', 'provider-website', 'Website URL is required');
        hasError = true;
    } else if (!isValidUrl(website)) {
        showFieldError('website-error', 'provider-website', 'Enter a valid URL (https://...)');
        hasError = true;
    }
    if (urls.length === 0) {
        showFieldError('urls-error', null, 'At least one pricing URL is required');
        hasError = true;
    }

    if (hasError) return;

    const saveBtn = document.getElementById('save-provider-btn');
    const btnText = saveBtn.querySelector('.btn-text');
    const btnLoading = saveBtn.querySelector('.btn-loading');

    saveBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';

    const verificationResults = [];
    let allValid = true;

    showVerificationResults([]);

    for (const url of urls) {
        verificationResults.push({ url, status: 'verifying', message: 'Verifying...' });
        showVerificationResults([...verificationResults]);

        try {
            const res = await fetch(`${API_BASE}/api/verify-endpoint`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const result = await res.json();

            const idx = verificationResults.findIndex(r => r.url === url);
            verificationResults[idx] = { ...result };
            showVerificationResults([...verificationResults]);

            if (result.status !== 'success') {
                allValid = false;
            }
        } catch (err) {
            const idx = verificationResults.findIndex(r => r.url === url);
            verificationResults[idx] = { url, status: 'error', message: `Failed: ${err.message}` };
            showVerificationResults([...verificationResults]);
            allValid = false;
        }
    }

    if (!allValid) {
        saveBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/providers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, website, pricing_urls: urls }),
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Failed to add provider');
            return;
        }

        document.getElementById('add-provider-modal').classList.remove('active');
        await loadProviders();
        await loadDashboard();
    } catch (err) {
        alert(`Failed to save provider: ${err.message}`);
    } finally {
        saveBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

function showFieldError(errorId, inputId, message) {
    document.getElementById(errorId).textContent = message;
    if (inputId) document.getElementById(inputId).classList.add('invalid');
}

function showVerificationResults(results) {
    const container = document.getElementById('verification-results');
    const list = document.getElementById('verification-list');

    if (results.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    list.innerHTML = results.map(r => {
        const iconClass = r.status === 'success' ? 'success' : r.status === 'warning' ? 'warning' : r.status === 'verifying' ? 'verifying' : 'error';
        const icon = r.status === 'success' ? '✓' : r.status === 'warning' ? '!' : r.status === 'verifying' ? '⟳' : '✕';
        return `
            <div class="verification-item">
                <div class="verification-icon ${iconClass}">${icon}</div>
                <div class="verification-details">
                    <div class="verification-url">${escapeHtml(r.url)}</div>
                    <div class="verification-message">${escapeHtml(r.message)}</div>
                    ${r.responseTime ? `<div class="verification-meta">${r.responseTime}ms · ${r.contentLength || 0} chars</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

const style = document.createElement('style');
style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
document.head.appendChild(style);
