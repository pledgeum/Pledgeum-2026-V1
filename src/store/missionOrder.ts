import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';

export interface MissionOrder {
    id: string;
    conventionId: string;
    teacherId: string;
    studentId: string; // To link to student info

    schoolAddress: string;
    companyAddress: string;
    distanceKm: number;

    status: 'PENDING' | 'SIGNED' | 'REJECTED';

    // Signature
    signatureDate?: string;
    signatureHash?: string;
    signatureImg?: string;

    createdAt: string;
}

interface MissionOrderState {
    missionOrders: MissionOrder[];

    createMissionOrder: (data: Omit<MissionOrder, 'id' | 'status' | 'createdAt'>) => Promise<string>;
    signMissionOrders: (ids: string[], signatureImg: string, signerName: string) => Promise<void>;
    getMissionOrders: () => MissionOrder[];
    getMissionOrderByConvention: (conventionId: string) => MissionOrder | undefined;
    fetchMissionOrders: () => Promise<void>;
}

export const useMissionOrderStore = create<MissionOrderState>()(
    persist(
        (set, get) => ({
            missionOrders: [],

            createMissionOrder: async (data) => {
                const newOrder: Omit<MissionOrder, 'id'> = {
                    ...data,
                    status: 'PENDING',
                    createdAt: new Date().toISOString()
                };

                try {
                    const docRef = await addDoc(collection(db, "missionOrders"), newOrder);
                    const id = docRef.id;

                    set((state) => ({
                        missionOrders: [...state.missionOrders, { ...newOrder, id }]
                    }));
                    return id;
                } catch (error) {
                    console.error("Error creating mission order:", error);
                    // Fallback to local
                    const id = Math.random().toString(36).substr(2, 9);
                    set((state) => ({
                        missionOrders: [...state.missionOrders, { ...newOrder, id }]
                    }));
                    return id;
                }
            },

            signMissionOrders: async (ids, signatureImg, signerName) => {
                const date = new Date().toISOString();
                const hash = `ODM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

                // Optimistic Update
                set((state) => ({
                    missionOrders: state.missionOrders.map(order => {
                        if (ids.includes(order.id)) {
                            return {
                                ...order,
                                status: 'SIGNED',
                                signatureDate: date,
                                signatureImg: signatureImg,
                                signatureHash: hash
                            };
                        }
                        return order;
                    })
                }));

                // Firestore Update in Parallel
                try {
                    await Promise.all(ids.map(id =>
                        updateDoc(doc(db, "missionOrders", id), {
                            status: 'SIGNED',
                            signatureDate: date,
                            signatureImg: signatureImg,
                            signatureHash: hash
                        })
                    ));
                } catch (error) {
                    console.error("Error signing mission orders in DB:", error);
                    // Revert or alert? For now log.
                }
            },

            getMissionOrders: () => get().missionOrders,

            getMissionOrderByConvention: (conventionId) => {
                return get().missionOrders.find(m => m.conventionId === conventionId);
            },

            fetchMissionOrders: async () => {
                try {
                    const querySnapshot = await getDocs(collection(db, "missionOrders"));
                    const orders: MissionOrder[] = [];
                    querySnapshot.forEach((doc) => {
                        orders.push({ id: doc.id, ...doc.data() } as MissionOrder);
                    });
                    set({ missionOrders: orders });
                } catch (error) {
                    console.error("Error fetching mission orders:", error);
                }
            }
        }),
        {
            name: 'mission-order-storage',
        }
    )
);
