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
