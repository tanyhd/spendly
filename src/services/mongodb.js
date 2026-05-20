const { MongoClient, ObjectId } = require('mongodb');

export function createObjectId() {
    return new ObjectId();
}

let cachedClient = null;
let cachedDb = null;

export async function connectToDb() {
    if (cachedClient && cachedDb) return cachedDb;

    const client = new MongoClient(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    await client.connect();
    const db = client.db(process.env.MONGODB_DBNAME);

    cachedClient = client;
    cachedDb = db;

    console.log(`Connected to MongoDB at ${process.env.MONGODB_URI}, db: ${process.env.MONGODB_DBNAME}`);

    return db;
}

export async function findUserByEmail(email) {
    const db = await connectToDb();
    return await db.collection('users').findOne({ email });
}

export async function createUser(id, email, name, password) {
    const db = await connectToDb();

    const result = await db.collection('users').insertOne({
        _id: id,
        email,
        name,
        password,
        createdAt: new Date(),
    });

    if (result.insertedCount !== 1) {
        throw new Error('Failed to insert user');
    }
}

export async function getUserById(userId) {
    const db = await connectToDb();
    return await db.collection('users').findOne({ _id: new ObjectId(userId) });
}

export async function updateUserInfo(userId, name, email) {
    const db = await connectToDb();
    return await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $set: { name, email } },
        { returnDocument: 'after' }
    );
}

export async function updateUserPassword(userId, password) {
    const db = await connectToDb();
    return await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $set: { password } },
        { returnDocument: 'after' }
    );
}

export async function deleteUser(userId) {
    const db = await connectToDb();
    return await db.collection('users').deleteOne({ _id: new ObjectId(userId) });
}

export async function getBudget(userId, year, month) {
    const db = await connectToDb();
    return await db.collection('monthly_plans').findOne({
        userId: new ObjectId(userId), year, month,
    });
}

export async function upsertBudget(userId, year, month, data) {
    const db = await connectToDb();
    await db.collection('monthly_plans').updateOne(
        { userId: new ObjectId(userId), year, month },
        { $set: { ...data, updatedAt: new Date() } },
        { upsert: true }
    );
}

export async function getWeekEntries(userId, weekStart, weekEnd) {
    const db = await connectToDb();
    return await db.collection('daily_entries')
        .find({ userId: new ObjectId(userId), date: { $gte: weekStart, $lte: weekEnd } })
        .sort({ date: 1, _id: 1 })
        .toArray();
}

export async function createEntry(userId, data) {
    const db = await connectToDb();
    const doc = { userId: new ObjectId(userId), ...data, createdAt: new Date() };
    const result = await db.collection('daily_entries').insertOne(doc);
    return { ...doc, _id: result.insertedId };
}

export async function updateEntry(userId, id, patch) {
    const db = await connectToDb();
    return await db.collection('daily_entries').updateOne(
        { _id: new ObjectId(id), userId: new ObjectId(userId) },
        { $set: { ...patch, updatedAt: new Date() } }
    );
}

export async function deleteEntry(userId, id) {
    const db = await connectToDb();
    return await db.collection('daily_entries').deleteOne({
        _id: new ObjectId(id),
        userId: new ObjectId(userId),
    });
}
