const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

// Get API key
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('ERROR: GEMINI_API_KEY is not set in environment variables');
    process.exit(1);
}

// Correct API URL format for Gemini
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=" + API_KEY;

// Test API connection on startup
async function testApiConnection() {
    try {
        console.log('Testing Gemini API connection...');
        const response = await axios.post(
            GEMINI_API_URL,
            {
                contents: [{
                    parts: [{
                        text: "Test connection"
                    }]
                }]
            }
        );
        console.log('API Test successful:', {
            status: response.status,
            hasData: !!response.data
        });
        return true;
    } catch (error) {
        console.error('API Test failed:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            error: error.response?.data?.error,
            message: error.message
        });
        return false;
    }
}

// Generate question endpoint
app.post('/api/get-question', async (req, res) => {
    const { domain } = req.body;
    
    if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
    }

    try {
        const response = await axios.post(
            GEMINI_API_URL,
            {
                contents: [{
                    parts: [{
                        text: `Generate a challenging interview question for the ${domain} domain. The question should be detailed and technical.`
                    }]
                }]
            }
        );

        const question = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!question) {
            throw new Error('No question received from API');
        }

        res.json({ question });
    } catch (error) {
        console.error('Error in get-question:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to generate question',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Grade answer endpoint
app.post('/api/grade-answer', async (req, res) => {
    const { domain, question, userAnswer } = req.body;

    if (!domain || !question || !userAnswer) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const response = await axios.post(
            GEMINI_API_URL,
            {
                contents: [{
                    parts: [{
                        text: `For the ${domain} interview question: "${question}"\n\nCandidate's answer: "${userAnswer}"\n\nPlease evaluate this answer and provide:\n1. A score out of 100\n2. Detailed feedback explaining the score`
                    }]
                }]
            }
        );

        const feedback = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        // Extract score from feedback
        const scoreMatch = feedback.match(/\b(\d{1,3})[\/\s]*100/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;

        res.json({ score, feedback });
    } catch (error) {
        console.error('Error in grade-answer:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to grade answer',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

app.listen(PORT, async () => {
    console.log(`Server starting on port ${PORT}...`);
    const isConnected = await testApiConnection();
    if (isConnected) {
        console.log('Server is ready to handle requests');
    } else {
        console.log('Server started but API connection test failed - check your API key');
    }
});