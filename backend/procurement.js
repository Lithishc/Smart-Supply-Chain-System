import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, addDoc, query, where, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const tableBody = document.querySelector('#procurement-table tbody');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login to access procurement.");
    window.location.href = "../login.html";
    return;
  }
  loadInventoryForProcurement(user.uid);
});

async function loadInventoryForProcurement(uid) {
  tableBody.innerHTML = "";
  const inventorySnap = await getDocs(collection(db, "users", uid, "inventory"));
  for (const itemDoc of inventorySnap.docs) {
    const item = itemDoc.data();
    const presetMode = item.presetMode || false;
    const presetQty = Number(item.presetQty) || 0;
    const quantity = Number(item.quantity) || 0;

    // Check if procurement request already exists for this item and is open
    let existingRequest = null;
    let offersHtml = "-";
    let requestStatus = "-";
    let requestId = null;

    const reqQuery = query(
      collection(db, "users", uid, "procurementRequests"),
      where("itemID", "==", item.itemID),
      where("status", "==", "open")
    );
    const reqSnap = await getDocs(reqQuery);
    reqSnap.forEach(docRef => {
      existingRequest = docRef.data();
      requestId = docRef.id;
    });

    // Show supplier offers if request exists
    if (existingRequest && existingRequest.supplierResponses && existingRequest.supplierResponses.length > 0) {
      offersHtml = existingRequest.supplierResponses.map((offer, idx) => `
        <div style="margin-bottom:8px; border-bottom:1px solid #eee;">
          <b>${offer.supplierName}</b>: ₹${offer.price}<br>
          <span>${offer.details}</span><br>
          <button onclick="window.acceptOffer('${uid}','${requestId}',${idx})">Accept</button>
        </div>
      `).join("");
      requestStatus = "Requested";
    } else if (existingRequest) {
      requestStatus = "Requested";
      offersHtml = "No offers yet";
    }

    tableBody.innerHTML += `
      <tr>
        <td>${item.itemName}</td>
        <td>${item.quantity}</td>
        <td>
          <input type="checkbox" ${presetMode ? "checked" : ""} 
            onchange="window.togglePreset('${itemDoc.id}', this.checked)">
        </td>
        <td>
          <input type="number" min="1" value="${item.presetQty || ""}" style="width:60px;"
            onchange="window.setPresetQty('${itemDoc.id}', this.value)">
        </td>
        <td>${requestStatus}</td>
        <td>${offersHtml}</td>
      </tr>
    `;
  }
}

// Accept supplier offer
window.acceptOffer = async (uid, requestId, offerIdx) => {
  const reqRef = doc(db, "users", uid, "procurementRequests", requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;
  const reqData = reqSnap.data();
  reqData.status = "closed";
  reqData.acceptedOffer = reqData.supplierResponses[offerIdx];
  await updateDoc(reqRef, reqData);

  // Also update global procurementRequests
  // Find the global request by itemID, userUid, and status open
  const globalReqQuery = query(
    collection(db, "procurementRequests"),
    where("itemID", "==", reqData.itemID),
    where("userUid", "==", uid),
    where("status", "==", "open")
  );
  const globalSnap = await getDocs(globalReqQuery);
  for (const docRef of globalSnap.docs) {
    await updateDoc(doc(db, "procurementRequests", docRef.id), {
      status: "closed",
      acceptedOffer: reqData.supplierResponses[offerIdx]
    });
  }

  alert("Offer accepted!");
  loadInventoryForProcurement(uid);
};

window.togglePreset = async (itemDocId, checked) => {
  const user = auth.currentUser;
  if (!user) return;
  const itemRef = doc(db, "users", user.uid, "inventory", itemDocId);
  await updateDoc(itemRef, { presetMode: checked });
  loadInventoryForProcurement(user.uid);
};

window.setPresetQty = async (itemDocId, qty) => {
  const user = auth.currentUser;
  if (!user) return;
  const itemRef = doc(db, "users", user.uid, "inventory", itemDocId);
  await updateDoc(itemRef, { presetQty: qty });
  loadInventoryForProcurement(user.uid);
};