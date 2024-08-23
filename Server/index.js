const PORT = 8002;
const express = require('express');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config(); // Make sure to use environment variables for sensitive data

const uri = process.env.MONGODB_URI; // Use environment variables for URI


const app = express();
app.use(cors());
app.use(express.json());

// Default Route
app.get('/', (req, res) => {
    res.json('Hello to my app');
});

// Sign up Route
app.post('/signup', async (req, res) => {
    const client = new MongoClient(uri);
    const { email, password } = req.body;

    const generatedUserId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await client.connect();
        const database = client.db('app-data');
        const users = database.collection('users');

        const existingUser = await users.findOne({ email });

        if (existingUser) {
            return res.status(409).send('User already exists. Please login');
        }

        const sanitizedEmail = email.toLowerCase();

        const data = {
            user_id: generatedUserId,
            email: sanitizedEmail,
            hashed_password: hashedPassword
        };

        await users.insertOne(data);

        const token = jwt.sign({ user_id: generatedUserId }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });

        res.status(200).json({ token, userId: generatedUserId });

    } catch (err) {
        console.log(err);
        res.status(500).json('Internal Server Error');
    } finally {
        await client.close();
    }
});

// Log in Route
app.post('/login', async (req, res) => {
    const client = new MongoClient(uri);
    const { email, password } = req.body;

    try {
        await client.connect();
        const database = client.db('app-data');
        const users = database.collection('users');

        const user = await users.findOne({ email });

        if (!user || !await bcrypt.compare(password, user.hashed_password)) {
            return res.status(400).json('Invalid Credentials');
        }

        const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });

        res.status(200).json({ token, userId: user.user_id });

    } catch (err) {
        console.log(err);
        res.status(500).json('Internal Server Error');
    } finally {
        await client.close();
    }
});

// Get Individual User
app.get('/user', async (req, res) => {
    const client = new MongoClient(uri);
    const userId = req.query.userId;

    try {
        await client.connect();
        const database = client.db('app-data');
        const users = database.collection('users');

        const user = await users.findOne({ user_id: userId });
        if (!user) {
            return res.status(404).json('User not found');
        }

        res.json(user);

    } catch (err) {
        console.log(err);
        res.status(500).json('Internal Server Error');
    } finally {
        await client.close();
    }
});

// Update User with a Match
app.put('/addmatch', async (req, res) => {
    const client = new MongoClient(uri);
    const { userId, matchedUserId } = req.body;

    try {
        await client.connect();
        const database = client.db('app-data');
        const users = database.collection('users');

        const result = await users.updateOne(
            { user_id: userId },
            { $push: { matches: { user_id: matchedUserId } } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json('User not found');
        }

        res.json(result);

    } catch (err) {
        console.log(err);
        res.status(500).json('Internal Server Error');
    } finally {
        await client.close();
    }
});

// Get All Users by userIds
app.get('/users', async (req, res) => {
    const client = new MongoClient(uri);
    const userIdsQuery = req.query.userIds;

    if (!userIdsQuery) {
        return res.status(400).json('No user IDs provided');
    }

    let userIds = [];
    try {
        userIds = JSON.parse(userIdsQuery);
        if (!Array.isArray(userIds)) {
            return res.status(400).json('User IDs should be an array');
        }
    } catch (error) {
        return res.status(400).json('Invalid user IDs format');
    }

    try {
        await client.connect();
        const database = client.db('app-data');
        const users = database.collection('users');

        const foundUsers = await users.find({ user_id: { $in: userIds } }).toArray();
        res.json(foundUsers);

    } catch (err) {
        console.log(err);
        res.status(500).json('Internal Server Error');
    } finally {
        await client.close();
    }
});

// Get All Gendered Users
app.get('/gendered-users', async (req, res) => {
    const client = new MongoClient(uri);
    const gender = req.query.gender;

    try {
        await client.connect();
        const database = client.db('app-data');
        const users = database.collection('users');

        const foundUsers = await users.find({ gender_identity: gender }).toArray();
        res.json(foundUsers);

    } catch (err) {
        console.log(err);
        res.status(500).json('Internal Server Error');
    } finally {
        await client.close();
    }
});

// Update a User
app.put('/user', async (req, res) => {
    const client = new MongoClient(uri);
    const formData = req.body.formData;

    try {
        await client.connect();
        const database = client.db('app-data');
        const users = database.collection('users');

        const result = await users.updateOne(
            { user_id: formData.user_id },
            { $set: formData }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json('User not found');
        }

        res.json(result);

    } catch (err) {
        console.log(err);
        res.status(500).json('Internal Server Error');
    } finally {
        await client.close();
    }
});

// Get Messages by from_userId and to_userId
app.get('/messages', async (req, res) => {
    const { userId, correspondingUserId } = req.query;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const database = client.db('app-data');
        const messages = database.collection('messages');

        const foundMessages = await messages.find({
            from_userId: userId,
            to_userId: correspondingUserId
        }).toArray();

        res.json(foundMessages);

    } catch (err) {
        console.log(err);
        res.status(500).json('Internal Server Error');
    } finally {
        await client.close();
    }
});

// Add a Message
app.post('/message', async (req, res) => {
    const client = new MongoClient(uri);
    const message = req.body.message;

    try {
        await client.connect();
        const database = client.db('app-data');
        const messages = database.collection('messages');

        const insertedMessage = await messages.insertOne(message);
        res.json(insertedMessage);

    } catch (err) {
        console.log(err);
        res.status(500).json('Internal Server Error');
    } finally {
        await client.close();
    }
});

app.listen(PORT, () => console.log('Server running on PORT ' + PORT));