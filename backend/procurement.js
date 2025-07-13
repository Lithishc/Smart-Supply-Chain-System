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
    let offerCount = 0;

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

    if (existingRequest && existingRequest.supplierResponses) {
      offerCount = existingRequest.supplierResponses.length;
      offersHtml = `
        <button onclick="window.viewOffers('${uid}','${requestId}')">
          View Offers (${offerCount})
        </button>
      `;
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

// Modal or section to show offers
window.viewOffers = async (uid, requestId) => {
  const reqRef = doc(db, "users", uid, "procurementRequests", requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;
  const reqData = reqSnap.data();
  const offers = reqData.supplierResponses || [];
  let html = `<h3>Supplier Offers</h3>`;
  if (offers.length === 0) {
    html += "<p>No offers yet.</p>";
  } else {
    offers.forEach((offer, idx) => {
      html += `
        <div style="border-bottom:1px solid #eee; margin-bottom:10px; padding-bottom:8px;">
          <b>${offer.supplierName}</b>: ₹${offer.price}<br>
          <span>${offer.details}</span><br>
          <button onclick="window.acceptOffer('${uid}','${requestId}',${idx})">Accept</button>
          <button onclick="window.rejectOffer('${uid}','${requestId}',${idx})">Reject</button>
        </div>
      `;
    });
  }
  // Show in a modal or a div (for demo, use alert or a simple div)
  let modal = document.getElementById('offers-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'offers-modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.background = '#fff';
    modal.style.padding = '24px';
    modal.style.borderRadius = '16px';
    modal.style.boxShadow = '0 8px 32px 0 rgba(31,38,135,0.18)';
    modal.style.zIndex = '9999';
    modal.innerHTML = `<button onclick="document.body.removeChild(this.parentNode)">Close</button><div id="offers-content"></div>`;
    document.body.appendChild(modal);
  }
  modal.querySelector('#offers-content').innerHTML = html;
  modal.style.display = 'block';
};

// Accept supplier offer and create order
window.acceptOffer = async (uid, requestId, offerIdx) => {
  const reqRef = doc(db, "users", uid, "procurementRequests", requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;
  const reqData = reqSnap.data();
  reqData.status = "closed";
  reqData.acceptedOffer = reqData.supplierResponses[offerIdx];
  await updateDoc(reqRef, reqData);

  // Also update global procurementRequests
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

  // Add to orders
  await addDoc(collection(db, "users", uid, "orders"), {
    itemID: reqData.itemID,
    itemName: reqData.itemName,
    quantity: reqData.requestedQty,
    supplier: reqData.supplierResponses[offerIdx].supplierName,
    price: reqData.supplierResponses[offerIdx].price,
    details: reqData.supplierResponses[offerIdx].details,
    status: "confirmed",
    createdAt: new Date()
  });

  alert("Offer accepted and order created!");
  document.getElementById('offers-modal').remove();
  loadInventoryForProcurement(uid);
};

// Reject supplier offer
window.rejectOffer = async (uid, requestId, offerIdx) => {
  const reqRef = doc(db, "users", uid, "procurementRequests", requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;
  const reqData = reqSnap.data();
  reqData.supplierResponses.splice(offerIdx, 1);
  await updateDoc(reqRef, { supplierResponses: reqData.supplierResponses });
  alert("Offer rejected.");
  document.getElementById('offers-modal').remove();
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