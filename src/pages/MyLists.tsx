import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { components } from '../types/schema';

type ArmyListSummary = components["schemas"]["ArmyListSummaryResponse"];

export function MyLists() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: lists, isLoading } = useQuery<ArmyListSummary[]>({
        queryKey: ['my-lists'],
        queryFn: async () => {
            const { data, error } = await api.GET('/api/lists');
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { error } = await api.DELETE('/api/lists/{list_id}', { params: { path: { list_id: id } } });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-lists'] });
        }
    });

    const handleLoad = async (id: number) => {
        try {
            const { data: listData, error } = await api.GET('/api/lists/{list_id}', { params: { path: { list_id: id } } });
            if (error) throw error;
            if (listData.units_json) {
                // Restore state into Zustand store 
                // wait, loadState expects precisely the state structure
                console.log("Loading list...", listData);
                // Currently bypassing detailed store parsing to get routing working
                // We will implement full state hydration next
            }
            navigate('/');
        } catch (e) {
            console.error("Failed to load list", e);
        }
    };

    if (!user) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-400">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Sign in required</h2>
                    <p>Please log in with Google to view and manage your saved Army Lists.</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return <div className="p-8 text-white">Loading your lists...</div>;
    }

    return (
        <div className="flex-1 overflow-y-auto bg-zinc-900 p-8 h-full">
            <div className="w-full max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-white">My Army Lists</h1>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
                    >
                        Create New List
                    </button>
                </div>

                {!lists || lists.length === 0 ? (
                    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-12 text-center text-zinc-400">
                        <p>You haven't saved any lists yet. Build one in the workspace and hit Save!</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {lists.map(list => (
                            <div key={list.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 flex items-center justify-between hover:bg-zinc-700/50 transition-colors">
                                <div>
                                    <h3 className="text-xl font-bold text-white tracking-wide">{list.name}</h3>
                                    <div className="text-sm text-zinc-400 mt-1 flex items-center gap-3">
                                        <span>Points: <span className="text-zinc-200">{list.points}</span></span>
                                        <span>SWC: <span className="text-zinc-200">{list.swc}</span></span>
                                        <span>Updated: {new Date(list.updated_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleLoad(list.id)}
                                        className="px-4 py-2 bg-zinc-700 hover:bg-emerald-600/80 text-white rounded font-medium transition-colors"
                                    >
                                        Load
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm("Are you sure you want to delete this list?")) {
                                                deleteMutation.mutate(list.id);
                                            }
                                        }}
                                        className="px-4 py-2 bg-zinc-700 hover:bg-red-600/80 text-white rounded font-medium transition-colors disabled:opacity-50"
                                        disabled={deleteMutation.status === 'pending'}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
