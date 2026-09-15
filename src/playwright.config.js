const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './test/browser',
    fullyParallel: true,
    workers: 2,
    use: { baseURL: 'http://127.0.0.1:18090', serviceWorkers: 'block' },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } }
    ],
    webServer: {
        command: 'python3 -m http.server 18090 --bind 127.0.0.1 --directory public',
        url: 'http://127.0.0.1:18090',
        reuseExistingServer: false,
        stderr: 'ignore'
    }
});
