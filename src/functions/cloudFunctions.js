// In a Firebase Cloud Functions file
exports.cleanupOldCalls = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const db = admin.firestore();
  
  // Get calls older than 24 hours
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  const snapshot = await db.collection('calls')
    .where('created', '<', oneDayAgo.toISOString())
    .where('status', 'in', ['waiting', 'matched'])
    .get();
  
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { 
      status: 'expired',
      expiredAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  
  await batch.commit();
  console.log(`Cleaned up ${snapshot.size} old call documents`);
  
  return null;
});
