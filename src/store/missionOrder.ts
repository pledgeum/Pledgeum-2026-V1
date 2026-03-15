import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MissionOrder {
    id: string;
    conventionId: string;
    teacherId: string;
    studentId: string; // To link to student info

    schoolAddress: string;
    companyAddress: string;
    distanceKm: number;

    status: 'PENDING' | 'SIGNED' | 'REJECTED';

    // Signatures
    signature_data?: {
        teacher?: {
            date?: string;
            hash?: string;
            img?: string;
            name?: string;
            method?: string;
        };
        head?: {
            date?: string;
            hash?: string;
            img?: string;
            name?: string;
            method?: string;
        };
    };

    createdAt: string;
}

export const isOdmPendingForHead = (order: MissionOrder) => {
    const hasTeacherSigned = !!order.signature_data?.teacher?.hash;
    const hasHeadSigned = !!order.signature_data?.head?.hash;
    return hasTeacherSigned && !hasHeadSigned;
};

interface MissionOrderState {
    missionOrders: MissionOrder[];

    createMissionOrder: (data: Omit<MissionOrder, 'id' | 'status' | 'createdAt'>) => Promise<string>;
    signMissionOrders: (ids: string[], signatureImg: string, signerName: string) => Promise<void>;
    signMissionOrderTeacher: (orderId: string, signatureImg: string, signerName: string) => Promise<void>;
    getMissionOrders: () => MissionOrder[];
    getMissionOrderByConvention: (conventionId: string) => MissionOrder | undefined;
    fetchMissionOrders: () => Promise<void>;
}

export const useMissionOrderStore = create<MissionOrderState>()(
    persist(
        (set, get) => ({
            missionOrders: [],

            createMissionOrder: async (data) => {
                // Optimistic creation is risky for ID generation, so we await API response.
                try {
                    const response = await fetch('/api/mission-orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    if (!response.ok) throw new Error('Failed to create mission order');
                    const newOrder = await response.json();

                    set((state) => {
                        const existingIndex = state.missionOrders.findIndex(m => m.conventionId === data.conventionId);
                        if (existingIndex !== -1) {
                            const updated = [...state.missionOrders];
                            updated[existingIndex] = newOrder;
                            return { missionOrders: updated };
                        }
                        return { missionOrders: [...state.missionOrders, newOrder] };
                    });

                    return newOrder.id;
                } catch (error) {
                    console.error("Error creating mission order:", error);
                    // Fallback to local only for temporary dev without DB
                    const id = Math.random().toString(36).substr(2, 9);
                    const newOrder: MissionOrder = { ...data, id, status: 'PENDING', createdAt: new Date().toISOString() };
                    set((state) => ({
                        missionOrders: [...state.missionOrders, newOrder]
                    }));
                    return id;
                }
            },

            signMissionOrders: async (ids, signatureImg, signerName) => {
                // Optimistic Update
                const date = new Date().toISOString();
                const tempHash = `ODM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

                set((state) => ({
                    missionOrders: state.missionOrders.map(order =>
                        ids.includes(order.id) ? {
                            ...order,
                            status: 'SIGNED',
                            signature_data: {
                                ...order.signature_data,
                                head: {
                                    date: date,
                                    img: signatureImg,
                                    hash: tempHash,
                                    name: signerName
                                }
                            }
                        } : order
                    )
                }));

                // API Update in Parallel
                try {
                    await Promise.all(ids.map(async id => {
                        const response = await fetch(`/api/mission-orders/${id}/sign`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ signatureImg, signerName, role: 'head' })
                        });

                        if (!response.ok) throw new Error(`Failed to sign ${id}`);
                    }));
                } catch (error) {
                    console.error("Error signing mission orders (Head):", error);
                }
            },

            signMissionOrderTeacher: async (orderId, signatureImg, signerName) => {
                // Optimistic Update
                const date = new Date().toISOString();
                const tempHash = `ODM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

                set((state) => ({
                    missionOrders: state.missionOrders.map(order =>
                        order.id === orderId ? {
                            ...order,
                            status: 'SIGNED',
                            signature_data: {
                                ...order.signature_data,
                                teacher: {
                                    date: date,
                                    img: signatureImg,
                                    hash: tempHash,
                                    name: signerName
                                }
                            }
                        } : order
                    )
                }));
                // API Update
                try {
                    const response = await fetch(`/api/mission-orders/${orderId}/sign-teacher`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ signatureImg, signerName, role: 'teacher' })
                    });

                    if (!response.ok) throw new Error(`Failed to sign ${orderId}`);
                } catch (error) {
                    console.error("Error signing mission order teacher:", error);
                    // Rollback optimistic update if needed or handle offline gracefully
                }
            },

            getMissionOrders: () => get().missionOrders,

            getMissionOrderByConvention: (conventionId) => {
                return get().missionOrders.find(m => m.conventionId === conventionId);
            },

            fetchMissionOrders: async () => {
                try {
                    const response = await fetch('/api/mission-orders');
                    if (!response.ok) throw new Error('Failed to fetch mission orders');

                    const orders = await response.json();
                    set({ missionOrders: orders });
                } catch (error) {
                    console.error("Error fetching mission orders:", error);
                }
            }
        }),
        {
            name: 'mission-order-storage', // Keep local storage cache
        }
    )
);
