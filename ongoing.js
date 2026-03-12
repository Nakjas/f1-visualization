// ========== F1 Ranking & Voting System ==========
// Configuration
const CONFIG = {
    API_BASE: 'https://api.openf1.org/v1',
    REFRESH_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    LOCAL_STORAGE_KEYS: {
        DRIVERS_DATA: 'f1_drivers_data',
        RACE_HISTORY: 'f1_race_history',
        LAST_UPDATE: 'f1_last_update',
        USER_VOTE: 'f1_user_vote',
        VOTES: 'f1_votes'
    }
};

// State Management
const state = {
    drivers: [],
    raceHistory: [],
    votes: {},
    userVote: null,
    lastUpdate: null,
    currentSeason: new Date().getFullYear(),
    chartInstances: {
        bump: null,
        bar: null
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    console.log('Initializing F1 Ranking & Voting System...');
    
    loadVotesFromStorage();
    
    const lastUpdate = getLastUpdateTime();
    if (shouldRefreshData(lastUpdate)) {
        await fetchAndDisplayData();
    } else {
        loadDataFromStorage();
        displayCharts();
        populateDriverSelect();
        displayVotingResults();
    }
    
    setupEventListeners();
    
    setInterval(() => {
        const lastUpdate = getLastUpdateTime();
        if (shouldRefreshData(lastUpdate)) {
            fetchAndDisplayData();
        }
    }, 60 * 60 * 1000); // Check every hour
}

async function fetchAndDisplayData() {
    showStatus('Fetching latest F1 data...', 'info');
    
    try {
        const standings = await fetchSeasonStandings();
        
        if (standings && standings.length > 0) {
            state.drivers = standings;
            saveDataToStorage(standings);
            updateLastUpdateTime();
            Charts();
            populateDriverSelect();
            displayVotingResults();
            showStatus('Data refreshed successfully!', 'success');
        } else {
            showStatus('No data available. Please try again later.', 'error');
            loadSampleData();
            displayCharts();
            populateDriverSelect();
            displayVotingResults();
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        showStatus('Error fetching data. Using cached data if available.', 'error');
        loadDataFromStorage();
        displayCharts();
        populateDriverSelect();
        displayVotingResults);
        displayRankingsTable();
    }
}

async function fetchSeasonStandings() {
    try {
        const season = state.currentSeason;
        
        const response = await fetch(`${CONFIG.API_BASE}/drivers?session_key=latest`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const drivers = await response.json();
        
        const resultsResponse = await fetch(`${CONFIG.API_BASE}/results?session_key=latest`);
        const results = await resultsResponse.json();
        
        return processDriversData(drivers, results, season);
        
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

function processDriversData(drivers, results, season) {
    const processedDrivers = [];
    
    const resultMap = {};
    if (results && Array.isArray(results)) {
        results.forEach(result => {
            resultMap[result.driver_number] = result;
        });
    }
    
    if (drivers && Array.isArray(drivers)) {
        drivers.forEach((driver, index) => {
            const raceResult = resultMap[driver.driver_number] || {};
            
            processedDrivers.push({
                position: index + 1,
                name: `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Unknown',
                team: driver.team_name || 'Unknown',
                racePoints: raceResult.points || 0,
                seasonPoints: raceResult.points || 0, // This may need adjustment based on actual API response
                driverId: driver.driver_number || index + 1
            });
        });
    }
    
    return processedDrivers.sort((a, b) => a.position - b.position);
}, driverId: 1 },
        { position: 2, name: 'Lando Norris', team: 'McLaren', racePoints: 18, seasonPoints: 358, driverId: 2 },
        { position: 3, name: 'Carlos Sainz', team: 'Ferrari', racePoints: 15, seasonPoints: 308, driverId: 3 },
        { position: 4, name: 'Lewis Hamilton', team: 'Mercedes', racePoints: 12, seasonPoints: 285, driverId: 4 },
        { position: 5, name: 'Charles Leclerc', team: 'Ferrari', racePoints: 10, seasonPoints: 275, driverId: 5 },
        { position: 6, name: 'Oscar Piastri', team: 'McLaren', racePoints: 8, seasonPoints: 260, driverId: 6 },
        { position: 7, name: 'George Russell', team: 'Mercedes', racePoints: 6, seasonPoints: 245, driverId: 7 },
        { position: 8, name: 'Fernando Alonso', team: 'Aston Martin', racePoints: 4, seasonPoints: 68, driverId: 8 },
        { position: 9, name: 'Yuki Tsunoda', team: 'Racing Bulls', racePoints: 2, seasonPoints: 52, driverId: 9 },
        { position: 10, name: 'Sergio Pérez', team: 'Red Bull Racing', racePoints: 1, seasonPoints: 45, driverId: 10 }
    ];
    
    state.raceHistory = [
        {
            raceName: 'Australia',
// ========== Display Functions ==========
function populateDriverSelect() {
    const driverSelect = document.getElementById('driverSelect');
    driverSelect.innerHTML = '<option value="">-- Choose a driver --</option>';
    
    state.drivers.forEach(driver => {
        const option = document.createElement('option');
        option.value = driver.driverId;
        option.textContent = `${driver.position}. ${driver.name} (${driver.team})`;
        driverSelect.appendChild(option);
    });
}

function displayCharts() {
    const bumpCanvas = document.getElementById('bumpChart');
    const pointsCanvas = document.getElementById('pointsChart');
    
    if (!bumpCanvas || !pointsCanvas) {
        console.error('Chart containers not found');
        return;
    }
    
    if (state.chartInstances.bump) {
        state.chartInstances.bump.destroy();
    }
    if (state.chartInstances.bar) {
        state.chartInstances.bar.destroy();
    }
    
    renderBumpChart(bumpCanvas);
    renderPointsChart(pointsCanvas);
}

function renderBumpChart(canvas) {
    const ctx = canvas.getContext('2d');
    
    const datasets = [];
    const colors = [
    const yourVoteSpan = document.getElementById('yourVote');
    
    const sortedVotes = Object.entries(state.votes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const totalVotes = Object.values(state.votes).reduce((sum, count) => sum + count, 0);
    totalVotesSpan.textContent = totalVotes;
    
    if (state.userVote) {
        yourVoteSpan.textContent = state.userVote.driverName;
        yourVoteSpan.style.color = 'var(--accent-yellow)';
    } else {
        yourVoteSpan.textContent = 'Not voted';
        yourVoteSpan.style.color = '#888';
    }ons.find(p => p.driverId === driver.driverId);
            return racePosition ? racePosition.position : null;
        });
        
        datasets.push({
            label: driver.name,
            data: data,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length],
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: colors[index % colors.length],
            fill: false
        });
    });
    
    state.chartInstances.bump = new Chart(ctx, {
        type: 'line',
        data: {
            labels: state.raceHistory.map(race => race.raceName),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    reverse: true,
                    min: 1,
                    max: 10,
                    ticks: {
                        color: '#e8e8e8',
                        font: { size: 11 }
                    },
                    grid: {
                        color: '#2a3f5f',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        color: '#e8e8e8',
                        font: { size: 11 }
                    },
                    grid: {
                        color: '#2a3f5f',
                        display: false
                    }
                }
            }
        }) {
    const driverSelect = document.getElementById('driverSelect');
    const driverId = parseInt(driverSelect.value);
    
    if (!driverId) {
        showStatus('Please select a driver to vote for', 'error');
        return;
    }
    
    const driver = state.drivers.find(d => d.driverId === driverId);
    if (!driver) {
        showStatus('Driver not found', 'error');
        return;
    }
    
    state.userVote = { driverId, driverName: driver.name };
    saveUserVoteToStorage(state.userVote);
    
    if (!state.votes[driver.name]) {
        state.votes[driver.name] = 0;
    }
    state.votes[driver.name]++;
    saveVotesToStorage();
    
    driverSelect.value = '';
    displayVotingResults();
    
    showStatus(`Vote recorded for ${driver.n> d.seasonPoints),
                backgroundColor: colors.slice(0, sortedDrivers.length),
                borderColor: '#c41e3a',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
        
        const raceHistory = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.RACE_HISTORY);
        if (raceHistory) {
            state.raceHistory = JSON.parse(raceHistory);
        }
    } catch (error) {
        console.error('Error loading data from storage:', error);
    }
}

function saveRaceHistoryToStorage(raceHistory) {
    try {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.RACE_HISTORY, JSON.stringify(raceHistory));
    } catch (error) {
        console.error('Error saving race history
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#e8e8e8',
                        font: { size: 11 }
                    },
                    grid: { color: '#2a3f5f' }
                },
                y: {
                    ticks: {
                        color: '#e8e8e8',
                        font: { size: 11 }
                    },
                    grid: { display: false }
                }
            }
        }position: 4 }, { driverId: 5, position: 5 }, { driverId: 6, position: 6 },
                { driverId: 7, position: 7 }, { driverId: 8, position: 8 }, { driverId: 9, position: 9 }, { driverId: 10, position: 10 }
            ]
        },
        {
            raceName: 'United States',
            positions: [
                { driverId: 1, position: 1 }, { driverId: 2, position: 2 }, { driverId: 3, position: 3 },
                { driverId: 4, position: 4 }, { driverId: 5, position: 5 }, { driverId: 6, position: 6 },
                { driverId: 7, position: 7 }, { driverId: 8, position: 8 }, { driverId: 9, position: 9 }, { driverId: 10, position: 10 }
            ]
        }
    ];
    
    saveDataToStorage(state.drivers);
    saveRaceHistoryToStorage(state.raceHistorye Russell', team: 'Mercedes', racePoints: 6, seasonPoints: 245 },
        { position: 8, name: 'Fernando Alonso', team: 'Aston Martin', racePoints: 4, seasonPoints: 68 },
        { position: 9, name: 'Yuki Tsunoda', team: 'Racing Bulls', racePoints: 2, seasonPoints: 52 },
        { position: 10, name: 'Sergio Pérez', team: 'Red Bull Racing', racePoints: 1, seasonPoints: 45 }
    ];
    saveDataToStorage(state.drivers);
    updateLastUpdateTime();
}

function displayRankingsTable() {
    const tbody = document.getElementById('driversTableBody');
    tbody.innerHTML = '';
    
    if (state.drivers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No driver data available</td></tr>';
        return;
    }
    
    state.drivers.forEach(driver => {
        const row = document.createElement('tr');
        const userVoteClass = state.userVote?.driverId === driver.driverId ? 'voted' : '';
        
        row.innerHTML = `
            <td>${driver.position}</td>
            <td>${driver.name}</td>
            <td>${driver.team || 'N/A'}</td>
            <td>${driver.racePoints}</td>
            <td><strong>${driver.seasonPoints}</strong></td>
            <td>
                <button class="vote-btn ${userVoteClass}" 
                        onclick="voteForDriver(event, ${driver.driverId}, '${driver.name.replace(/'/g, "\\'")}')">
                    ${state.userVote?.driverId === driver.driverId ? '✓ Voted' : 'Vote'}
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function displayVotingResults() {
    const votesDisplay = document.getElementById('votesDisplay');
    const totalVotesSpan = document.getElementById('totalVotes');
    
    const sortedVotes = Object.entries(state.votes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10 votes
    
    const totalVotes = Object.values(state.votes).reduce((sum, count) => sum + count, 0);
    totalVotesSpan.textContent = totalVotes;
    
    if (sortedVotes.length === 0) {
        votesDisplay.innerHTML = '<p class="loading-text">No votes yet. Be the first to vote!</p>';
        return;
    }
    
    votesDisplay.innerHTML = sortedVotes
        .map(([name, count]) => `
            <div class="vote-item">
                <span class="vote-item-name">${name}</span>
                <span class="vote-item-count">${count}</span>
            </div>
        `)
        .join('');
}

// ========== Voting System ==========
function voteForDriver(event, driverId, driverName) {
    event.preventDefault();
    
    // Save user's vote
    state.userVote = { driverId, driverName };
    saveUserVoteToStorage({ driverId, driverName });
    
    // Record vote
    if (!state.votes[driverName]) {
        state.votes[driverName] = 0;
    }
    state.votes[driverName]++;
    saveVotesToStorage();
    
    // Refresh display
    displayRankingsTable();
    displayVotingResults();
    
    showStatus(`Vote recorded for ${driverName}!`, 'success');
}

// ========== Storage Functions ==========
function saveDataToStorage(drivers) {
    try {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.DRIVERS_DATA, JSON.stringify(drivers));
    } catch (error) {
        console.error('Error saving data to storage:', error);
    }
}

function loadDataFromStorage() {
    try {
        const data = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.DRIVERS_DATA);
        if (data) {
            state.drivers = JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading data from storage:', error);
    }
}

function saveVotesToStorage() {
    try {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.VOTES, JSON.stringify(state.votes));
    } catch (error) {
        console.error('Error saving votes:', error);
    }
}

function loadVotesFromStorage() {
    try {
        const votes = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.VOTES);
        if (votes) {
            state.votes = JSON.parse(votes);
        }
        
        const userVote = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.USER_VOTE);
        if (userVote) {
            state.userVote = JSON.parse(userVote);
        }
    } catch (error) {
        console.error('Error loading votes from storage:', error);
    }
}

function saveUserVoteToStorage(vote) {
    try {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.USER_VOTE, JSON.stringify(vote));
    } catch (error) {
        console.error('Error saving user vote:', error);
    }
}

function updateLastUpdateTime() {
    const now = new Date().toISOString();
    state.lastUpdate = now;
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.LAST_UPDATE, now);
    
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = `Last Updated: ${formatDateTime(now)}`;
    }
}

function getLastUpdateTime() {
    const lastUpdate = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.LAST_UPDATE);
    return lastUpdate ? new Date(lastUpdate) : null;
}

function shouldRefreshData(lastUpdate) {
    if (!lastUpdate) return true;
    const timeDiff = Date.now() - lastUpdate.getTime();
    return timeDiff > CONFIG.REFRESH_INTERVAL;
}

// ========== UI Helpers ==========
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    
    const voteSubmitBtn = document.getElementById('voteSubmitBtn');
    if (voteSubmitBtn) {
        voteSubmitBtn.addEventListener('click', voteForDriver);
    }
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    
    // Auto-clear after 5 seconds (except for errors)
    if (type !== 'error') {
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status-message';
        }, 5000);
    }
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ========== Event Listeners ==========
function setupEventListeners() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchAndDisplayData();
        });
    }
}

// Initialize app
console.log('F1 Ranking & Voting System loaded');
