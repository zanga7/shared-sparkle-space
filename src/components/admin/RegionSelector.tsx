import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CountryInfo {
  countryCode: string;
  name: string;
}

interface CountryDetail {
  commonName: string;
  officialName: string;
  countryCode: string;
  region: string;
  borders: CountryInfo[] | null;
}

interface RegionSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (region: { code: string; name: string; flag: string; isSubdivision?: boolean }) => void;
  selectedRegions: string[];
}

// Function to get flag emoji from country code
const getFlagEmoji = (countryCode: string): string => {
  const code = countryCode.split('-')[0]; // Get base country code (e.g., AU from AU-NSW)
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export const RegionSelector = ({
  open,
  onOpenChange,
  onSelect,
  selectedRegions,
}: RegionSelectorProps) => {
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [subdivisions, setSubdivisions] = useState<Record<string, CountryDetail>>({});

  useEffect(() => {
    if (open) {
      fetchCountries();
    }
  }, [open]);

  const fetchCountries = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://date.nager.at/api/v3/AvailableCountries');
      if (!response.ok) throw new Error('Failed to fetch countries');
      const data: CountryInfo[] = await response.json();
      setCountries(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      toast.error('Failed to load countries');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCountryDetails = async (countryCode: string) => {
    if (subdivisions[countryCode]) return; // Already fetched

    try {
      const response = await fetch(`https://date.nager.at/api/v3/CountryInfo/${countryCode}`);
      if (!response.ok) throw new Error('Failed to fetch country details');
      const data: CountryDetail = await response.json();
      setSubdivisions((prev) => ({ ...prev, [countryCode]: data }));
    } catch (error) {
      console.error(`Failed to fetch details for ${countryCode}:`, error);
    }
  };

  const toggleCountryExpansion = async (countryCode: string) => {
    const newExpanded = new Set(expandedCountries);
    if (newExpanded.has(countryCode)) {
      newExpanded.delete(countryCode);
    } else {
      newExpanded.add(countryCode);
      await fetchCountryDetails(countryCode);
    }
    setExpandedCountries(newExpanded);
  };

  const handleSelectCountry = (country: CountryInfo) => {
    const flag = getFlagEmoji(country.countryCode);
    onSelect({
      code: country.countryCode,
      name: country.name,
      flag,
      isSubdivision: false,
    });
  };

  const handleSelectSubdivision = (countryCode: string, subdivisionCode: string, subdivisionName: string) => {
    const flag = getFlagEmoji(countryCode);
    onSelect({
      code: subdivisionCode,
      name: subdivisionName,
      flag,
      isSubdivision: true,
    });
  };

  const filteredCountries = countries.filter((country) =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.countryCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSubdivisionsList = (countryCode: string): Array<{ code: string; name: string }> => {
    const detail = subdivisions[countryCode];
    if (!detail?.borders) return [];
    
    // For now, we'll use a hardcoded list for countries with known subdivisions
    // The Nager API doesn't always provide subdivision details, so we augment with known data
    if (countryCode === 'AU') {
      return [
        { code: 'AU-NSW', name: 'New South Wales' },
        { code: 'AU-VIC', name: 'Victoria' },
        { code: 'AU-QLD', name: 'Queensland' },
        { code: 'AU-WA', name: 'Western Australia' },
        { code: 'AU-SA', name: 'South Australia' },
        { code: 'AU-TAS', name: 'Tasmania' },
        { code: 'AU-ACT', name: 'Australian Capital Territory' },
        { code: 'AU-NT', name: 'Northern Territory' },
      ];
    }
    if (countryCode === 'US') {
      return [
        { code: 'US-AL', name: 'Alabama' },
        { code: 'US-CA', name: 'California' },
        { code: 'US-FL', name: 'Florida' },
        { code: 'US-NY', name: 'New York' },
        { code: 'US-TX', name: 'Texas' },
        // Add more as needed
      ];
    }
    if (countryCode === 'CA') {
      return [
        { code: 'CA-ON', name: 'Ontario' },
        { code: 'CA-QC', name: 'Quebec' },
        { code: 'CA-BC', name: 'British Columbia' },
        { code: 'CA-AB', name: 'Alberta' },
        // Add more as needed
      ];
    }
    return [];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Country or Region</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search countries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-1">
                {filteredCountries.map((country) => {
                  const subdivisionsList = getSubdivisionsList(country.countryCode);
                  const hasSubdivisions = subdivisionsList.length > 0;
                  const isExpanded = expandedCountries.has(country.countryCode);
                  const isSelected = selectedRegions.includes(country.countryCode);

                  return (
                    <div key={country.countryCode} className="border rounded-lg">
                      <div className="flex items-center gap-2 p-3 hover:bg-accent/50 transition-colors">
                        {hasSubdivisions && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleCountryExpansion(country.countryCode)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="flex-1 justify-start gap-2 h-auto py-2"
                          onClick={() => handleSelectCountry(country)}
                        >
                          <span className="text-2xl">{getFlagEmoji(country.countryCode)}</span>
                          <span className="font-medium">{country.name}</span>
                          <Badge variant="secondary" className="ml-auto">
                            {country.countryCode}
                          </Badge>
                          {isSelected && (
                            <Badge variant="default" className="ml-2">
                              Selected
                            </Badge>
                          )}
                        </Button>
                      </div>

                      {hasSubdivisions && isExpanded && (
                        <div className="border-t bg-muted/30 p-2 space-y-1">
                          {subdivisionsList.map((subdivision) => {
                            const isSubSelected = selectedRegions.includes(subdivision.code);
                            return (
                              <Button
                                key={subdivision.code}
                                variant="ghost"
                                className="w-full justify-start gap-2 h-auto py-2 pl-12"
                                onClick={() =>
                                  handleSelectSubdivision(
                                    country.countryCode,
                                    subdivision.code,
                                    subdivision.name
                                  )
                                }
                              >
                                <span className="text-lg">{getFlagEmoji(country.countryCode)}</span>
                                <span>{subdivision.name}</span>
                                <Badge variant="outline" className="ml-auto">
                                  {subdivision.code}
                                </Badge>
                                {isSubSelected && (
                                  <Badge variant="default" className="ml-2">
                                    Selected
                                  </Badge>
                                )}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
