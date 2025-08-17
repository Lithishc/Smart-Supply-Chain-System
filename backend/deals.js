import { db } from "./firebase-config.js";
import { collection, getDocs, doc, updateDoc, arrayUnion, getDoc, query, where, addDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const auth = getAuth();
const tableBody = document.querySelector('#supplier-table tbody');

async function loadOpenRequests(supplierUid) {
  const marketplaceList = document.querySelector('.marketplace-list');
  if (!marketplaceList) return;
  marketplaceList.innerHTML = "";
  const reqSnap = await getDocs(collection(db, "globalProcurementRequests"));
  reqSnap.forEach((docSnap) => {
    const req = docSnap.data();
    // Only show requests NOT made by this supplier
    if (req.status === "open" && req.userUid !== supplierUid) {
      marketplaceList.innerHTML += `
        <div class="deal-card">
          <div class="deal-details">
            <div class="deal-title">${req.itemName}</div>
            <div class="deal-meta">
              <span><b>Requested Qty:</b> ${req.requestedQty}</span>
              <span><b>Location:</b> ${req.location || "N/A"}</span>
            </div>
            <div class="deal-meta">
              <span><b>Requested By:</b> ${req.userUid}</span>
            </div>
          </div>
          <button class="pill-btn" onclick="window.showOfferPopup('${docSnap.id}')">Send Offer</button>
        </div>
      `;
    }
  });
}

let currentReqId = null;

window.showOfferPopup = function(reqId) {
  currentReqId = reqId;
  document.getElementById('offer-popup').style.display = 'flex';
};

window.closeOfferPopup = function() {
  document.getElementById('offer-popup').style.display = 'none';
  document.getElementById('offer-form').reset();
  currentReqId = null;
};

document.getElementById('offer-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const form = e.target;
  const supplierName = form.supplierName.value;
  const price = form.price.value;
  const details = form.details.value;

  const auth = getAuth();
  const supplierUid = auth.currentUser ? auth.currentUser.uid : null;
  if (!supplierUid) {
    alert("You must be logged in as a supplier to send an offer.");
    return;
  }

  const offerData = {
    globalProcurementId: currentReqId,
    supplierName,
    price,
    details,
    supplierUid,
    createdAt: new Date(),
    status: "pending"
  };

  const offerRef = await addDoc(collection(db, "users", supplierUid, "offers"), offerData);
  const offerId = offerRef.id;
  offerData.offerId = offerId;

  const reqRef = doc(db, "globalProcurementRequests", currentReqId);
  await updateDoc(reqRef, {
    supplierResponses: arrayUnion(offerData)
  });

  const reqSnap = await getDoc(reqRef);
  if (reqSnap.exists()) {
    const reqData = reqSnap.data();
    const userUid = reqData.userUid;
    const globalProcurementId = reqSnap.id;

    const userReqQuery = query(
      collection(db, "users", userUid, "procurementRequests"),
      where("globalProcurementId", "==", globalProcurementId),
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
  window.closeOfferPopup();
  loadOpenRequests(supplierUid);
});

// Wait for authentication before loading requests
onAuthStateChanged(auth, (user) => {
  if (user) {
    loadOpenRequests(user.uid);
  }
});