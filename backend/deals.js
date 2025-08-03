import { db } from "./firebase-config.js";
import { collection, getDocs, doc, updateDoc, arrayUnion, getDoc, query, where, addDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const auth = getAuth();
const supplierUid = auth.currentUser ? auth.currentUser.uid : null;

const tableBody = document.querySelector('#supplier-table tbody');

async function loadOpenRequests() {
  tableBody.innerHTML = "";
  const reqSnap = await getDocs(collection(db, "procurementRequests"));
  reqSnap.forEach((docSnap) => {
    const req = docSnap.data();
    if (req.status === "open") {
      tableBody.innerHTML += `
        <tr>
          <td>${req.itemName}</td>
          <td>${req.requestedQty}</td>
          <td>
            <form onsubmit="window.sendOffer(event, '${docSnap.id}')">
              <input type="text" name="supplierName" placeholder="Your Name" required>
              <input type="number" name="price" placeholder="Offer Price" required>
              <input type="text" name="details" placeholder="Details" required>
              <button type="submit">Send Offer</button>
            </form>
          </td>
        </tr>
      `;
    }
  });
}

// This function must be global for inline form onsubmit
window.sendOffer = async (e, reqId) => {
  e.preventDefault();
  const form = e.target;
  const supplierName = form.supplierName.value;
  const price = form.price.value;
  const details = form.details.value;

  // Get supplierUid at the time of offer
  const auth = getAuth();
  const supplierUid = auth.currentUser ? auth.currentUser.uid : null;
  if (!supplierUid) {
    alert("You must be logged in as a supplier to send an offer.");
    return;
  }

  // Create offer object
  const offerData = {
    requestId: reqId,
    supplierName,
    price,
    details,
    supplierUid,
    createdAt: new Date(),
    status: "pending" // Track status for supplier
  };

  // Store offer in supplier's own offers subcollection and get offerId
  const offerRef = await addDoc(collection(db, "users", supplierUid, "offers"), offerData);
  const offerId = offerRef.id;
  offerData.offerId = offerId;

  // Update global procurementRequests
  const reqRef = doc(db, "procurementRequests", reqId);
  await updateDoc(reqRef, {
    supplierResponses: arrayUnion(offerData)
  });

  // Also update the user's procurementRequests
  const reqSnap = await getDoc(reqRef);
  if (reqSnap.exists()) {
    const reqData = reqSnap.data();
    const userUid = reqData.userUid;
    const userReqQuery = query(
      collection(db, "users", userUid, "procurementRequests"),
      where("itemID", "==", reqData.itemID),
      where("status", "==", "open")
    );
    const userReqSnap = await getDocs(userReqQuery);
    for (const userDoc of userReqSnap.docs) {
      await updateDoc(doc(db, "users", userUid, "procurementRequests", userDoc.id), {
        supplierResponses: arrayUnion(offerData)
      });
    }
  }

  alert("Offer sent!");
  loadOpenRequests();
};

loadOpenRequests();