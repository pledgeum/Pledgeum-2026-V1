'use client';

import { useState, useEffect } from 'react';
import { useUserStore } from '@/store/user';
import { useSchoolStore } from '@/store/school';
import { 
  FileBadge, 
  ChevronLeft, 
  Search, 
  Filter, 
  Download, 
  Clock, 
  CheckCircle, 
  Building, 
  Calendar,
  User,
  ArrowRight,
  Plus,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface AttestationData {
  id: string;
  date_start: string;
  date_end: string;
  convention_status: string;
  company_name: string;
  student_first_name: string;
  student_last_name: string;
  class_name: string;
  class_id: string;
  attestation_signed_at: string | null;
}

export default function AttestationsHubPage() {
  const router = useRouter();
  const { role, uai } = useUserStore();
  const { classes, fetchSchoolData } = useSchoolStore();
  
  const [attestations, setAttestations] = useState<AttestationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'past' | 'upcoming'>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Security: Only staff can filter by class
  const isStaff = ['teacher', 'school_head', 'ddfpt', 'at_ddfpt', 'admin', 'SUPER_ADMIN'].includes(role || '');

  useEffect(() => {
    // 1. Fetch school data (classes) ONLY if user is staff
    if (isStaff && uai) {
      fetchSchoolData(uai);
    }

    // 2. Fetch attestations from isolated V2 API
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/attestations');
        const data = await res.json();
        if (data.success) {
          setAttestations(data.data);
        } else {
          toast.error("Erreur lors du chargement des attestations: " + (data.error || "Inconnu"));
        }
      } catch (error) {
        console.error("Fetch error:", error);
        toast.error("Erreur réseau");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [uai, isStaff, fetchSchoolData]);

  const filteredAttestations = attestations.filter(a => {
    const now = new Date();
    const endDate = new Date(a.date_end);
    
    // Tab Filter
    if (activeTab === 'past' && endDate >= now) return false;
    if (activeTab === 'upcoming' && endDate < now) return false;
    
    // Class Filter (Only applied if staff)
    if (isStaff && selectedClass !== 'all' && a.class_id !== selectedClass) return false;
    
    // Search Filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      return (
        a.student_first_name.toLowerCase().includes(searchLower) ||
        a.student_last_name.toLowerCase().includes(searchLower) ||
        a.company_name?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  const isSigned = (a: AttestationData) => !!a.attestation_signed_at;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Retour au tableau de bord"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FileBadge className="w-6 h-6 text-blue-600" />
                  Hub des Attestations
                </h1>
                <p className="text-sm text-gray-500">Suivi des signatures officielles</p>
              </div>
            </div>
            {isStaff && (
               <div className="hidden sm:block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                 Vue Établissement
               </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Filters bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 items-start md:items-center justify-between">
          <div className="flex p-1 bg-gray-200 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'past' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Terminés
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'upcoming' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              À venir
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 sm:min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={isStaff ? "Nom élève ou entreprise..." : "Rechercher une entreprise..."}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {isStaff && (
              <select
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="all">Toutes les classes</option>
                {classes.map(cl => (
                  <option key={cl.id} value={cl.id}>{cl.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-gray-500 font-medium">Récupération sécurisée des données...</p>
          </div>
        ) : filteredAttestations.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-16 text-center shadow-sm">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transform transition-transform group-hover:scale-110">
              <FileBadge className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Aucune attestation trouvée</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              {searchQuery || selectedClass !== 'all' 
                ? "Aucun résultat ne correspond à vos filtres actuels."
                : "Les attestations apparaissent ici une fois que les stages sont validés."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAttestations.map((a) => (
              <div 
                key={a.id}
                className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 overflow-hidden flex flex-col"
              >
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-indigo-100">
                      {a.class_name}
                    </div>
                    {isSigned(a) ? (
                      <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-green-100">
                        <CheckCircle className="w-4 h-4" />
                        Signée
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-100">
                        <Clock className="w-4 h-4" />
                        En attente
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-extrabold text-gray-900 mb-1 group-hover:text-blue-700 transition-colors">
                    {a.student_first_name} {a.student_last_name}
                  </h3>
                  
                  <div className="space-y-3 mt-5">
                    <div className="flex items-center gap-4 text-sm text-gray-600 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                        <Building className="w-4.5 h-4.5" />
                      </div>
                      <span className="font-semibold">{a.company_name || 'Entreprise Inconnue'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                        <Calendar className="w-4.5 h-4.5" />
                      </div>
                      <span className="font-medium">
                        {new Date(a.date_start).toLocaleDateString('fr-FR')} - {new Date(a.date_end).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between backdrop-blur-sm group-hover:bg-blue-50/30 transition-colors">
                  <button 
                    disabled={!isSigned(a)}
                    onClick={() => console.log('Download triggered for:', a.id)}
                    className={`flex items-center gap-2 text-sm font-extrabold transition-all active:scale-95 ${
                      isSigned(a) 
                      ? 'text-blue-600 hover:text-blue-800' 
                      : 'text-gray-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Download className="w-4.5 h-4.5" />
                    Télécharger
                  </button>
                  
                  {!isSigned(a) && (
                    <button 
                      onClick={() => console.log('Reminder triggered for:', a.id)}
                      className="text-orange-600 hover:text-orange-900 text-sm font-extrabold flex items-center gap-1 group/btn transition-colors active:scale-95"
                    >
                      Relancer
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
