import type { ObjectId } from 'mongodb';
import { collections, toObjectId, type UserDoc } from './db';

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
    const { users } = await collections();
    return users.findOne({ email });
}

export async function getUserById(userId: string): Promise<UserDoc | null> {
    const { users } = await collections();
    return users.findOne({ _id: toObjectId(userId) });
}

export async function createUser(id: ObjectId, email: string, name: string, passwordHash: string) {
    const { users } = await collections();
    const result = await users.insertOne({ _id: id, email, name, password: passwordHash, createdAt: new Date() });
    if (!result.acknowledged) throw new Error('Failed to insert user');
}

export async function updateUserInfo(userId: string, name: string, email: string) {
    const { users } = await collections();
    return users.findOneAndUpdate({ _id: toObjectId(userId) }, { $set: { name, email } }, { returnDocument: 'after' });
}

export async function updateUserPassword(userId: string, passwordHash: string) {
    const { users } = await collections();
    return users.findOneAndUpdate({ _id: toObjectId(userId) }, { $set: { password: passwordHash } }, { returnDocument: 'after' });
}

export async function deleteUser(userId: string) {
    const { users } = await collections();
    return users.deleteOne({ _id: toObjectId(userId) });
}
