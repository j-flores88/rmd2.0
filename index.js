// ==========================================
// FIREBASE SETUP & AUTHENTICATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD03q8HxJynvHLHshDsbBdKECk3_nYZ3vQ",
    authDomain: "rmduserdb.firebaseapp.com",
    projectId: "rmduserdb",
    storageBucket: "rmduserdb.appspot.com",
    messagingSenderId: "321756332773",
    appId: "1:321756332773:web:28d49fe18f4c2848770a0c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let globallySelectedGame = null;
let currentUserId = null;
let currentUserHandle = null;
let pendingMatchId = null;
let pendingMatchName = null;

// ==========================================
// SCREEN NAVIGATION STATE
// ==========================================
const showScreen = (screenId) => {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        targetScreen.classList.add('active');
    }
};

const loadMatches = async (uid) => {
    const matchesContainer = document.getElementById('matches-container');
    matchesContainer.innerHTML = '<div style="color: #00f3ff; font-style: italic;">ACCESSING MAINFRAME DATABANKS...</div>';

    try {
        const qUser = query(collection(db, "users"), where("userId", "==", uid));
        const userSnap = await getDocs(qUser);
        const currentUser = userSnap.docs[0].data(); 
        
        currentUserHandle = currentUser.networkHandle; 

        const qMatches = query(collection(db, "users"), where("selectedGame.id", "==", currentUser.selectedGame.id));
        const matchSnap = await getDocs(qMatches);

        const qSent = query(collection(db, "interactions"), where("senderId", "==", uid));
        const qReceived = query(collection(db, "interactions"), where("receiverId", "==", uid));
        const sentSnap = await getDocs(qSent);
        const receivedSnap = await getDocs(qReceived);
        
        let allInteractions = [];
        sentSnap.forEach(doc => allInteractions.push({ id: doc.id, ...doc.data() }));
        receivedSnap.forEach(doc => allInteractions.push({ id: doc.id, ...doc.data() }));

        matchesContainer.innerHTML = ''; 
        let matchCount = 0;

        matchSnap.forEach((doc) => {
            const targetUser = doc.data();
            if (targetUser.userId === uid) return;

            let isCompatible = false;
            if (currentUser.orientation === 'Straight') {
                if (currentUser.sex === 'Male') {
                    isCompatible = targetUser.sex === 'Female' && (targetUser.orientation === 'Straight' || targetUser.orientation === 'Bi');
                } else if (currentUser.sex === 'Female') {
                    isCompatible = targetUser.sex === 'Male' && (targetUser.orientation === 'Straight' || targetUser.orientation === 'Bi');
                }
            } else if (currentUser.orientation === 'Gay/Lesbian') {
                isCompatible = targetUser.sex === currentUser.sex && (targetUser.orientation === 'Gay/Lesbian' || targetUser.orientation === 'Bi');
            } else if (currentUser.orientation === 'Bi') {
                if (targetUser.orientation === 'Bi') {
                    isCompatible = true;
                } else if (targetUser.orientation === 'Straight') {
                    isCompatible = currentUser.sex !== targetUser.sex; 
                } else if (targetUser.orientation === 'Gay/Lesbian') {
                    isCompatible = currentUser.sex === targetUser.sex; 
                }
            }

            if (isCompatible) {
                matchCount++;
                const relationship = allInteractions.find(i => 
                    (i.senderId === uid && i.receiverId === targetUser.userId) || 
                    (i.receiverId === uid && i.senderId === targetUser.userId)
                );

                let actionHTML = '';

                if (!relationship) {
                    actionHTML = `<button class="submit-btn initiate-btn" data-uid="${targetUser.userId}" data-name="${targetUser.username}" style="margin-top: 15px; padding: 10px; font-size: 0.8rem; background: transparent; border: 1px solid #ff0055; color: #ff0055;">INITIATE MATCH</button>`;
                } else {
                    // Figure out who is who in this specific relationship
                    const isSender = relationship.senderId === uid;
                    const myDecision = isSender ? relationship.senderDecision : relationship.receiverDecision;
                    const theirContact = isSender ? relationship.receiverContact : relationship.senderContact;
                    const opponentHandle = isSender ? relationship.receiverHandle : relationship.senderHandle;

                    if (relationship.status === 'invite_sent' && isSender) {
                        actionHTML = `<div style="margin-top: 15px; padding: 10px; text-align: center; border: 1px dashed #777; color: #777; font-size: 0.8rem;">INVITE PENDING...</div>`;
                    
                    } else if (relationship.status === 'invite_sent' && !isSender) {
                        actionHTML = `
                            <div style="margin-top: 15px; border-top: 1px solid #00f3ff; padding-top: 10px;">
                                <p style="color: #00f3ff; font-size: 0.85rem; text-align: center; margin-bottom: 10px; font-family: 'Orbitron';">INCOMING REQUEST</p>
                                <button class="submit-btn accept-btn" data-intid="${relationship.id}" data-date="${relationship.proposedDates[0]}" style="margin-bottom: 5px; padding: 8px; font-size: 0.75rem; border: 1px solid #00f3ff; background: rgba(0,243,255,0.1);">ACCEPT: ${relationship.proposedDates[0]}</button>
                                <button class="submit-btn accept-btn" data-intid="${relationship.id}" data-date="${relationship.proposedDates[1]}" style="margin-bottom: 5px; padding: 8px; font-size: 0.75rem; border: 1px solid #00f3ff; background: rgba(0,243,255,0.1);">ACCEPT: ${relationship.proposedDates[1]}</button>
                                <button class="submit-btn accept-btn" data-intid="${relationship.id}" data-date="${relationship.proposedDates[2]}" style="margin-bottom: 5px; padding: 8px; font-size: 0.75rem; border: 1px solid #00f3ff; background: rgba(0,243,255,0.1);">ACCEPT: ${relationship.proposedDates[2]}</button>
                            </div>
                        `;
                    
                    } else if (relationship.status === 'game_over') {
                        // Someone pulled the plug!
                        actionHTML = `
                            <div style="margin-top: 15px; border-top: 1px solid #ff0055; padding-top: 10px; text-align: center;">
                                <p style="color: #ff0055; font-family: 'Orbitron'; font-size: 1.2rem; margin: 0;">GAME OVER</p>
                                <p style="color: #777; font-size: 0.8rem; margin-top: 5px;">CONNECTION SEVERED.</p>
                            </div>
                        `;
                    
                    } else if (relationship.status === 'mutual_rematch') {
                        // They both swiped right!
                        actionHTML = `
                            <div style="margin-top: 15px; border-top: 1px solid #00f3ff; padding-top: 10px; text-align: center;">
                                <p style="color: #00f3ff; font-family: 'Orbitron'; font-size: 1.2rem; margin: 0; text-shadow: 0 0 10px #00f3ff;">REMATCHED! 🔥</p>
                                <p style="color: #fff; font-size: 0.85rem; margin: 10px 0 5px 0;">TARGET'S CONTACT INFO:</p>
                                <p style="color: #ff0055; font-size: 1rem; font-family: 'Rajdhani'; font-weight: bold; margin: 0;">${theirContact}</p>
                            </div>
                        `;
                    
} else if (relationship.status === 'accepted') {
                        
                        // ==========================================
                        // TIME-LOCK MATH
                        // ==========================================
                        // 1. Grab the current year to make a perfect timestamp
                        const currentYear = new Date().getFullYear();
                        
                        // 2. Turn "September 20 at 20:00" into "September 20, 2026 20:00"
                        const parseableDate = relationship.agreedDate.replace(" at ", `, ${currentYear} `);
                        const playDateObj = new Date(parseableDate);
                        const now = new Date();
                        
                        // 3. Check if we have passed the scheduled play date!
                        const dateHasPassed = now >= playDateObj;

                        if (!dateHasPassed) {
                            // THE DATE IS STILL IN THE FUTURE: Hide the buttons!
                            actionHTML = `
                                <div style="margin-top: 15px; border-top: 1px solid #00f3ff; padding-top: 10px; text-align: center;">
                                    <p style="color: #00f3ff; font-family: 'Orbitron'; font-size: 1rem; margin: 0 0 5px 0;">DATE LOCKED ✓</p>
                                    <p style="color: #fff; font-size: 0.85rem; margin: 0 0 10px 0;">${relationship.agreedDate}</p>
                                    <p style="color: #ff0055; font-size: 0.75rem; margin: 0;">TARGET ACQUIRED. PLAY THEM AT:</p>
                                    <p style="color: #00f3ff; font-size: 1.2rem; font-family: 'Rajdhani'; font-weight: bold; margin: 5px 0; letter-spacing: 1px;">${opponentHandle}</p>
                                    <div style="margin-top: 15px; padding: 10px; border: 1px dashed #777; color: #777; font-size: 0.8rem; background: rgba(0,0,0,0.4);">
                                        AWAITING PLAY DATE...<br>RETURN HERE AFTERWARDS TO REMATCH.
                                    </div>
                                </div>
                            `;
                        } else if (!myDecision) {
                            // THE DATE HAS PASSED & WE HAVEN'T DECIDED YET: Show Rematch Buttons!
                            actionHTML = `
                                <div style="margin-top: 15px; border-top: 1px solid #00f3ff; padding-top: 10px; text-align: center;">
                                    <p style="color: #00f3ff; font-family: 'Orbitron'; font-size: 1rem; margin: 0 0 5px 0;">DATE LOCKED ✓</p>
                                    <p style="color: #fff; font-size: 0.85rem; margin: 0 0 10px 0;">${relationship.agreedDate}</p>
                                    <p style="color: #ff0055; font-size: 0.75rem; margin: 0;">TARGET ACQUIRED. PLAY THEM AT:</p>
                                    <p style="color: #00f3ff; font-size: 1.2rem; font-family: 'Rajdhani'; font-weight: bold; margin: 5px 0; letter-spacing: 1px;">${opponentHandle}</p>
                                    
                                    <p style="color: #ccc; font-size: 0.75rem; margin: 20px 0 10px 0; font-style: italic;">How did the play date go?</p>
                                    <input type="text" id="contact-info-${relationship.id}" class="neon-input cyan-input" placeholder="Your IG / Discord / Phone#" style="margin-bottom: 10px; font-size: 0.8rem; padding: 8px; width: 100%; box-sizing: border-box; text-align: center;">
                                    
                                    <div style="display: flex; gap: 10px;">
                                        <button class="submit-btn rematch-btn" data-intid="${relationship.id}" data-role="${isSender ? 'sender' : 'receiver'}" style="flex: 1; padding: 10px; font-size: 0.8rem; background: rgba(0,243,255,0.1); border: 1px solid #00f3ff; color: #00f3ff;">REMATCH</button>
                                        <button class="submit-btn gameover-btn" data-intid="${relationship.id}" data-role="${isSender ? 'sender' : 'receiver'}" style="flex: 1; padding: 10px; font-size: 0.8rem; background: rgba(255,0,85,0.1); border: 1px solid #ff0055; color: #ff0055;">GAME OVER</button>
                                    </div>
                                </div>
                            `;
                        } else if (myDecision === 'rematch') {
                            // WE HIT REMATCH, WAITING ON THEM
                            actionHTML = `
                                <div style="margin-top: 15px; border-top: 1px solid #00f3ff; padding-top: 10px; text-align: center;">
                                    <p style="color: #00f3ff; font-family: 'Orbitron'; font-size: 1rem; margin: 0 0 5px 0;">DATE LOCKED ✓</p>
                                    <p style="color: #ff0055; font-size: 0.75rem; margin: 0;">TARGET HANDLE:</p>
                                    <p style="color: #00f3ff; font-size: 1.2rem; font-family: 'Rajdhani'; font-weight: bold; margin: 5px 0; letter-spacing: 1px;">${opponentHandle}</p>
                                    <div style="margin-top: 15px; padding: 10px; border: 1px dashed #00f3ff; color: #00f3ff; font-size: 0.8rem;">AWAITING THEIR DECISION...</div>
                                </div>
                            `;
                        }
                    }
                }

                matchesContainer.innerHTML += `
                    <div class="match-card neon-panel cyan-panel">
                        <h3 class="pink-text" style="margin: 0 0 10px 0; font-family: 'Orbitron';">${targetUser.username}</h3>
                        <p style="color: #ccc; font-size: 0.9rem; margin: 5px 0;"><strong>AGE:</strong> ${targetUser.age}</p>
                        <p style="color: #ccc; font-size: 0.9rem; margin: 5px 0;"><strong>SEX:</strong> ${targetUser.sex}</p>
                        <p style="color: #ccc; font-size: 0.9rem; margin: 5px 0;"><strong>ORIENTATION:</strong> ${targetUser.orientation}</p>
                        <hr style="border-color: #333; margin: 15px 0;">
                        <p style="color: #00f3ff; font-size: 0.85rem; margin: 0 0 10px 0; text-align: center; text-transform: uppercase;">PLAYING: ${targetUser.selectedGame.name}</p>
                        ${actionHTML}
                    </div>
                `;
            }
        });

        if (matchCount === 0) {
            matchesContainer.innerHTML = '<div style="color: #ccc;">NO COMPATIBLE TARGETS FOUND IN YOUR SECTOR.</div>';
        }

    } catch (error) {
        console.error("Error fetching matches:", error);
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        
        // Check if they already have a profile
        const q = query(collection(db, "users"), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            showScreen('dashboard-screen');
            loadMatches(user.uid);
        } else {
            showScreen('setup-screen');
        }
    } else {
        currentUserId = null;
        showScreen('splash-screen');
    }
});

// ==========================================
// MAIN APPLICATION ENGINE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // --- NAVIGATION CONTROLS ---
    document.getElementById('nav-login-btn').addEventListener('click', () => showScreen('login-screen'));
    document.getElementById('nav-signup-btn').addEventListener('click', () => showScreen('signup-screen'));
    
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => showScreen('splash-screen'));
    });

    // --- AUTHENTICATION MODULE ---
    document.getElementById('signup-submit-btn').addEventListener('click', async () => {
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        
        if (!email || password.length < 6) {
            alert("SYSTEM ERROR: Valid email and 6+ character password required.");
            return;
        }

        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
            alert("ERROR: " + error.message);
        }
    });

    document.getElementById('login-submit-btn').addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            alert("SYSTEM ERROR: Enter credentials.");
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            alert("ERROR: Invalid Credentials.");
        }
    });

    // --- PASSWORD RESET LOGIC ---
    document.getElementById('forgot-password-btn').addEventListener('click', async () => {
        // Grab whatever email they typed into the login box
        const email = document.getElementById('login-email').value;

        if (!email) {
            alert("SYSTEM ERROR: Please enter your email address in the box above first.");
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            alert("TRANSMISSION SENT: Check your inbox for the password reset link.");
        } catch (error) {
            console.error("Reset Error:", error);
            alert("SYSTEM FAILURE: Could not send reset link. Ensure the email is correct.");
        }
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout Error:", error);
        }
    });

    // --- CYBERPUNK SEARCH ELEMENTS ---
    const consoleIcons = document.querySelectorAll('.consoleIcon');
    const spinner = document.querySelector('.spinnerOne');
    const searchBarContainer = document.getElementById('bar1');
    const searchInput = document.querySelector('.firstChoiceInput');
    const autoCompleteBox = document.querySelector('.auto-complete');
    const choiceDisplay = document.querySelector('.choiceDisplay');
    const confirmBtn = document.getElementById('confirm-btn');

    let currentGamesList = [];

    // --- STEP 1: SELECT PLATFORM & FETCH DATA ---
    consoleIcons.forEach(icon => {
        icon.addEventListener('click', async () => {
            let platformId;
            
            switch (icon.id) {
                case 'deskTop': platformId = "6"; break;
                case 'playStation': platformId = "(48, 167)"; break; 
                case 'xBox': platformId = "(49, 169)"; break;
                case 'switch': platformId = "130"; break;
                case 'ios': platformId = "39"; break;
                case 'android': platformId = "34"; break;
            }

            consoleIcons.forEach(i => {
                i.style.background = 'rgba(0,0,0,0.4)';
                i.style.color = '#777';
                i.style.borderColor = '#333';
            });
            
            icon.style.background = 'rgba(255, 0, 85, 0.2)';
            icon.style.color = '#ff0055';
            icon.style.borderColor = '#ff0055';

            spinner.classList.remove('hide');
            searchBarContainer.classList.add('hide');
            choiceDisplay.innerHTML = '<div style="text-align: center; color: #555; font-style: italic; margin-top: 20px;">Awaiting Query...</div>'; 
            searchInput.value = '';
            autoCompleteBox.innerHTML = '';
            globallySelectedGame = null; 

            const now = Math.floor(Date.now() / 1000);
            const query = `where release_dates.platform = ${platformId} & rating > 70 & release_dates.y >= 2018 & release_dates.date <= ${now} & game_modes = (2,3,5);
                           sort follows desc;
                           fields name,platforms.name,release_dates.human,cover.image_id,videos.video_id,rating,summary;
                           limit 250;`;

            try {
                const response = await fetch('/api/games', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: query
                });

                currentGamesList = await response.json();
                
                spinner.classList.add('hide');
                searchBarContainer.classList.remove('hide');
                
            } catch (error) {
                console.error("Connection Error:", error);
                spinner.innerText = "SERVER CONNECTION FAILED.";
                spinner.style.color = "red";
            }
        });
    });

    // --- STEP 2: AUTOCOMPLETE SEARCH ---
    searchInput.addEventListener('input', (e) => {
        const typedText = e.target.value.toLowerCase();
        autoCompleteBox.innerHTML = ''; 
        
        if (!typedText) return;

        const filteredGames = currentGamesList.filter(game => 
            game.name.toLowerCase().includes(typedText)
        );

        filteredGames.forEach(game => {
            const coverUrl = game.cover ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${game.cover.image_id}.png` : '';
            const gameRow = document.createElement('li');
            
            gameRow.innerHTML = `
                ${coverUrl ? `<img src="${coverUrl}">` : '<div style="width:25px; height:35px; background:#333; margin-right:8px; border-radius:2px;"></div>'}
                <span style="color: #e0e0e0; font-family: 'Rajdhani', sans-serif;">${game.name}</span>
            `;

            gameRow.addEventListener('click', () => {
                searchInput.value = game.name; 
                autoCompleteBox.innerHTML = ''; 
                globallySelectedGame = game; 
                displayFinalGame(game); 
            });

            autoCompleteBox.appendChild(gameRow);
        });
    });

    // --- STEP 3: DISPLAY FINAL TARGET ---
    const displayFinalGame = (game) => {
        const coverUrl = game.cover ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.png` : '';
        const platforms = game.platforms ? game.platforms.map(p => p.name).join(', ') : 'Unknown Platforms';
        const summary = game.summary ? game.summary.substring(0, 100) + '...' : 'No data available.';

        choiceDisplay.innerHTML = `
            <div style="background: rgba(0,0,0,0.4); border: 1px solid #ff0055; border-radius: 8px; padding: 15px; display: flex; color: #e0e0e0; margin-top: 10px; box-shadow: 0 5px 15px rgba(255,0,85,0.15);">
                ${coverUrl ? `<img src="${coverUrl}" style="width: 70px; height: 100px; object-fit: cover; border-radius: 4px; margin-right: 15px;">` : ''}
                <div>
                    <h4 style="margin: 0 0 5px 0; font-size: 1.1rem; color: #ff0055; font-family: 'Orbitron', sans-serif;">${game.name}</h4>
                    <p style="margin: 0 0 8px 0; font-size: 0.75rem; color: #ff99bb; text-transform: uppercase;">${platforms}</p>
                    <p style="margin: 0; font-size: 0.85rem; line-height: 1.3; color: #ccc; font-family: 'Rajdhani', sans-serif;">${summary}</p>
                </div>
            </div>
        `;
    };

    // --- STEP 4: SAVE PLAYER PROFILE & ROUTE TO DASHBOARD ---
    confirmBtn.addEventListener('click', async () => {
        const usernameInput = document.getElementById('username');
        const handleInput = document.getElementById('network-handle');
        const ageInput = document.getElementById('age');
        
        if (!usernameInput || !ageInput) {
            alert("SYSTEM ERROR: Missing HTML Inputs.");
            return;
        }

        const username = usernameInput.value;
        const networkHandle = handleInput.value;
        const age = ageInput.value;
        const sex = document.querySelector('input[name="sex"]:checked').value;
        const orientation = document.querySelector('input[name="orientation"]:checked').value;

        if (!username || !age) {
            alert("SYSTEM ERROR: Please enter a valid Username and Age.");
            return;
        }

        if (!globallySelectedGame) {
            alert("SYSTEM ERROR: Please search and select a game loadout first.");
            return;
        }

        if (!currentUserId) {
            alert("SYSTEM ERROR: You must be logged in to save a profile.");
            return;
        }

        confirmBtn.innerText = "UPLOADING TO MAINFRAME...";
        confirmBtn.style.backgroundColor = "#555";

        const newPlayer = {
            userId: currentUserId,
            username: `@${username.trim()}`,
            networkHandle: networkHandle.trim(),
            age: parseInt(age),
            sex: sex,
            orientation: orientation,
            selectedGame: {
                id: globallySelectedGame.id,
                name: globallySelectedGame.name
            },
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "users"), newPlayer);
            
            confirmBtn.innerText = "IDENTITY CONFIRMED ✓";
            confirmBtn.style.backgroundColor = "#00f3ff";
            confirmBtn.style.color = "#000";

            // Automatically transition to Dashboard 1 second after saving!
            // Automatically transition to Dashboard 1 second after saving!
            setTimeout(() => {
                showScreen('dashboard-screen');
                loadMatches(currentUserId); 
            }, 1000);
            
        } catch (error) {
            console.error("🚨 Error adding document to database: ", error);
            confirmBtn.innerText = "UPLOAD FAILED";
            confirmBtn.style.backgroundColor = "red";
        }
    });

    // ==========================================
    // DYNAMIC DATE & TIME GENERATOR
    // ==========================================
    const populateDateDropdowns = () => {
        // 1. Calculate Current & Next Month
        const monthsArr = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const today = new Date();
        const currentMonth = monthsArr[today.getMonth()];
        const nextMonth = monthsArr[(today.getMonth() + 1) % 12]; // The % 12 ensures December rolls over to January!

        const monthHTML = `<option value="${currentMonth}">${currentMonth}</option><option value="${nextMonth}">${nextMonth}</option>`;
        
        // 2. Generate Days (1 - 31)
        let dayHTML = '';
        for (let i = 1; i <= 31; i++) {
            dayHTML += `<option value="${i}">${i}</option>`;
        }

        // 3. Generate 24-Hour Times (00:00 - 23:30 in 30-min increments)
        let timeHTML = '';
        for (let i = 0; i < 24; i++) {
            const hour = i.toString().padStart(2, '0'); // Ensures single digits have a leading zero (e.g., "09")
            timeHTML += `<option value="${hour}:00">${hour}:00</option>`;
            timeHTML += `<option value="${hour}:30">${hour}:30</option>`;
        }

        // 4. Inject the generated HTML into all 3 Option rows
        [1, 2, 3].forEach(num => {
            document.getElementById(`opt${num}-month`).innerHTML = monthHTML;
            document.getElementById(`opt${num}-day`).innerHTML = dayHTML;
            document.getElementById(`opt${num}-time`).innerHTML = timeHTML;
        });
    };

    // Run the function immediately when the page loads
    populateDateDropdowns();

    // ==========================================
    // PLAY DATE MODAL LOGIC
    // ==========================================
    const dateModal = document.getElementById('date-modal');

    // 1. Open the modal when "INITIATE MATCH" is clicked
    document.getElementById('matches-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('initiate-btn')) {
            // Save the target's info to our global variables
            pendingMatchId = e.target.getAttribute('data-uid');
            pendingMatchName = e.target.getAttribute('data-name');
            
            // Show the modal
            dateModal.classList.remove('hidden');
            dateModal.classList.add('active');
        }
    });

    // 2. Close the modal on Cancel
    document.getElementById('cancel-invite-btn').addEventListener('click', () => {
        dateModal.classList.remove('active');
        dateModal.classList.add('hidden');
        pendingMatchId = null;
    });

    // 3. Send the Invite to Firebase!
    document.getElementById('send-invite-btn').addEventListener('click', async () => {
        const sendBtn = document.getElementById('send-invite-btn');
        sendBtn.innerText = "TRANSMITTING...";

        // Grab the 3 date options from the dropdowns
        const opt1 = `${document.getElementById('opt1-month').value} ${document.getElementById('opt1-day').value} at ${document.getElementById('opt1-time').value}`;
        const opt2 = `${document.getElementById('opt2-month').value} ${document.getElementById('opt2-day').value} at ${document.getElementById('opt2-time').value}`;
        const opt3 = `${document.getElementById('opt3-month').value} ${document.getElementById('opt3-day').value} at ${document.getElementById('opt3-time').value}`;

        const newInteraction = {
            senderId: currentUserId,
            senderHandle: currentUserHandle,
            receiverId: pendingMatchId,
            receiverName: pendingMatchName,
            status: "invite_sent", // We will track where they are in the loop!
            proposedDates: [opt1, opt2, opt3],
            createdAt: new Date().toISOString()
        };

        try {
            // Save to a brand new "interactions" collection!
            await addDoc(collection(db, "interactions"), newInteraction);
            
            sendBtn.innerText = "INVITE SENT ✓";
            sendBtn.style.backgroundColor = "#ff0055";
            sendBtn.style.color = "#000";

            // Hide the modal after 1.5 seconds
            setTimeout(() => {
                dateModal.classList.remove('active');
                dateModal.classList.add('hidden');
                sendBtn.innerText = "SEND \"LET'S PLAY!\""; // Reset button text
                sendBtn.style.backgroundColor = "transparent";
                sendBtn.style.color = "#ff0055";
            }, 1500);

        } catch (error) {
            console.error("Error sending invite:", error);
            sendBtn.innerText = "TRANSMISSION FAILED";
        }
    });

    // ==========================================
    // ACCEPT PLAY DATE & REVEAL HANDLES
    // ==========================================
    document.getElementById('matches-container').addEventListener('click', async (e) => {
        if (e.target.classList.contains('accept-btn')) {
            const interactionId = e.target.getAttribute('data-intid');
            const agreedDate = e.target.getAttribute('data-date');
            
            e.target.innerText = "UPDATING MAINFRAME...";
            e.target.style.backgroundColor = "#555";

            try {
                // Point to the exact interaction document in Firestore
                const interactionRef = doc(db, "interactions", interactionId);
                
                // Update the status and lock in the receiver's handle!
                await updateDoc(interactionRef, {
                    status: "accepted",
                    agreedDate: agreedDate,
                    receiverHandle: currentUserHandle
                });

                // Instantly reload the dashboard to show the big reveal!
                loadMatches(currentUserId);
                
            } catch (error) {
                console.error("Error accepting match:", error);
                alert("SYSTEM FAILURE: Could not accept match.");
                e.target.innerText = "ERROR";
            }
        }
    });

});

// ==========================================
    // POST-MATCH: GAME OVER & REMATCH LOGIC
    // ==========================================
    document.getElementById('matches-container').addEventListener('click', async (e) => {
        
        // --- 1. THE GAME OVER BUTTON ---
        if (e.target.classList.contains('gameover-btn')) {
            const interactionId = e.target.getAttribute('data-intid');
            const role = e.target.getAttribute('data-role'); // 'sender' or 'receiver'
            
            e.target.innerText = "SEVERING...";
            
            try {
                const interactionRef = doc(db, "interactions", interactionId);
                const updateData = { status: "game_over" };
                updateData[`${role}Decision`] = "game_over"; // Log who pulled the plug
                
                await updateDoc(interactionRef, updateData);
                loadMatches(currentUserId); // Reload the dashboard instantly
                
            } catch (error) {
                console.error("Error logging game over:", error);
            }
        }

        // --- 2. THE REMATCH BUTTON ---
        if (e.target.classList.contains('rematch-btn')) {
            const interactionId = e.target.getAttribute('data-intid');
            const role = e.target.getAttribute('data-role'); 
            
            // Grab the contact info they typed into the box
            const contactInput = document.getElementById(`contact-info-${interactionId}`).value;
            
            if (!contactInput) {
                alert("SYSTEM ERROR: Please provide your social handle or phone number to rematch!");
                return;
            }

            e.target.innerText = "PROCESSING...";

            try {
                const interactionRef = doc(db, "interactions", interactionId);
                
                // We need to fetch the document in real-time to see what the other person decided
                const docSnap = await getDoc(interactionRef);
                const interactionData = docSnap.data();

                // Figure out what the other role is called (if I am sender, they are receiver)
                const otherRole = role === 'sender' ? 'receiver' : 'sender';
                const theirDecision = interactionData[`${otherRole}Decision`];

                // Build our update payload
                const updateData = {};
                updateData[`${role}Decision`] = "rematch";
                updateData[`${role}Contact`] = contactInput.trim();

                // THE MAGIC CHECK: Did they already click rematch?
                if (theirDecision === "rematch") {
                    updateData.status = "mutual_rematch";
                }

                await updateDoc(interactionRef, updateData);
                loadMatches(currentUserId);

            } catch (error) {
                console.error("Error logging rematch:", error);
                e.target.innerText = "ERROR";
            }
        }
    });