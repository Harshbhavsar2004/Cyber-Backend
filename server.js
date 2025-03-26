const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const app = express();
const cors = require('cors');
const port = 3001;
const dotenv = require('dotenv');
dotenv.config();

const corsOptions = {
    origin: [
        'https://cyber-frontend-jade.vercel.app',  // Production frontend
        'https://cyber-frontend-jade.vercel.app/',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],  // Added OPTIONS for preflight requests
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],  // Added more headers
    credentials: true,
};

app.use(cors(corsOptions));

const credentials = {
    type: "service_account",
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY,
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
};

// Initialize Google Auth
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Google Sheets API instance
const sheets = google.sheets({ version: 'v4', auth });

// Spreadsheet ID (from the URL of your Google Sheet)
const SPREADSHEET_IDS = {
    '2025': '13dA2ZrojHegk4dwXIRz0yTfeZo1gy77QVx4ug3IRkEw',
    '2024': '1KclTD7lAMXaOMtndW4a_dx5BPi40DJuuF0Hl_UvwVPc'
};

app.use(express.json());

app.get('/api/case/:year/:ackNumber', async (req, res) => {
    const { year, ackNumber } = req.params;
    console.log(`Searching for Ack. No: ${ackNumber} in ${year} data`);

    try {
        const spreadsheetId = SPREADSHEET_IDS[year];
        if (!spreadsheetId) {
            return res.status(400).json({ error: 'Invalid year specified' });
        }

        // First, get the spreadsheet info to verify the sheet exists
        console.log('Verifying sheet existence...');
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId
        });

        // Log available sheets
        const sheetNames = spreadsheet.data.sheets.map(sheet => sheet.properties.title);
        console.log('Available sheets:', sheetNames);

        // Check if our target sheet exists
        const targetSheet = year === '2025' ? 'All Data 2025' : '2024 All Data';
        if (!sheetNames.includes(targetSheet)) {
            console.log(`❌ Sheet "${targetSheet}" not found!`);
            return res.status(404).json({ error: 'Sheet not found' });
        }

        console.log(`✅ Found sheet "${targetSheet}", fetching data...`);

        // Fetch data from the correct sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${targetSheet}!A:O`,
        });

        const rows = response.data.values;

        if (!rows || rows.length === 0) {
            console.log('❌ No data found in the sheet');
            return res.status(404).json({ error: 'No data found in the sheet' });
        }

        // Define headers based on the year
        const headers = year === '2025' ? rows[0] : [
            'Sr. No.', 'Ack. No.', 'Applicant Name', 'Date', 'Mobile No.',
            'Fraud Amount', 'Refund Amount', 'Fraud Type', 'Inquiry',
            'O/w No and Date', 'Status (Close/Tr.)'
        ];

        console.log('✅ Sheet data fetched successfully!');
        console.log('Total rows found:', rows.length);
        console.log('Headers:', headers);

        // Modified search logic to match last 5 digits
        const row = rows.find(row => {
            const cellValue = String(row[1]).trim(); // Ack. No. column
            const searchValue = String(ackNumber).trim();
            
            // Get last 5 digits of both values
            const cellLast5 = cellValue.slice(-5);
            const searchLast5 = searchValue.slice(-5);
            
            console.log('Comparing:', cellLast5, 'with:', searchLast5);
            return cellLast5 === searchLast5;
        });

        if (row) {
            console.log('✅ Found matching record for Ack. No:', ackNumber);
            const result = {};
            headers.forEach((key, index) => {
                result[key] = row[index] || '';
            });

            console.log('Sending response:', result);
            res.json(result);
        } else {
            console.log('❌ No matching record found for Ack. No:', ackNumber);
            res.status(404).json({ error: 'No records found for the given acknowledgment number' });
        }

    } catch (error) {
        console.error('❌ Error occurred:', error.message);
        console.error('Full error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

app.get('/', (req, res) => {
    res.send("Hello World")
})
