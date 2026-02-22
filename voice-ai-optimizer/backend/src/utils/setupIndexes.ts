import mongoose from 'mongoose';

/**
 * Creates database indexes for optimal query performance.
 * Called after models are registered.
 */
export async function setupIndexes(): Promise<void> {
  console.log('📊 Setting up database indexes...');

  const db = mongoose.connection.db;
  if (!db) {
    console.warn('⚠️ Database not connected, skipping index setup');
    return;
  }

  try {
    // TestSuites collection indexes
    const testSuitesCollection = db.collection('testsuites');
    await testSuitesCollection.createIndex(
      { agentId: 1, status: 1 },
      { background: true }
    );
    await testSuitesCollection.createIndex(
      { agentId: 1, createdAt: -1 },
      { background: true }
    );

    // TestResponses collection indexes
    const testResponsesCollection = db.collection('testresponses');
    await testResponsesCollection.createIndex(
      { executionId: 1, testCaseId: 1 },
      { background: true }
    );

    // OptimizationRecords collection indexes
    const optimizationRecordsCollection = db.collection('optimizationrecords');
    await optimizationRecordsCollection.createIndex(
      { agentId: 1, createdAt: -1 },
      { background: true }
    );
    await optimizationRecordsCollection.createIndex(
      { status: 1 },
      { background: true }
    );

    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    // Don't throw - indexes are optimization, not critical
  }
}
