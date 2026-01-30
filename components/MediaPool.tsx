'use client';

import { useState } from 'react';
import { MediaPool as MediaPoolType, MediaAsset } from '../types/mediaPool';
import styles from './MediaPool.module.css';

interface MediaPoolProps {
  conversationId: string;
  mediaPool: MediaPoolType | null;
  onAssetAction?: (action: 'approve' | 'use' | 'remove', assetId: string) => void;
  onToggle?: () => void;
}

type TabType = 'all' | 'images' | 'scripts' | 'uploads' | 'approved';

export function MediaPool({ conversationId, mediaPool, onAssetAction, onToggle }: MediaPoolProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  
  if (!mediaPool) {
    return null;
  }
  
  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (onToggle) {
      onToggle();
    }
  };
  
  const handleAction = (action: 'approve' | 'use' | 'remove', assetId: string) => {
    if (onAssetAction) {
      onAssetAction(action, assetId);
    }
  };
  
  // Filter assets based on active tab
  const allAssets = Object.values(mediaPool.assets);
  const filteredAssets = allAssets.filter(asset => {
    if (activeTab === 'all') return true;
    if (activeTab === 'images') return asset.url && (asset.type.includes('image') || asset.type === 'avatar' || asset.type === 'product');
    if (activeTab === 'scripts') return asset.type === 'script' || asset.type.includes('script');
    if (activeTab === 'uploads') return asset.type === 'user_upload' || asset.type.includes('upload');
    if (activeTab === 'approved') return asset.approved === true;
    return true;
  });
  
  const assetCount = allAssets.length;
  const approvedCount = allAssets.filter(a => a.approved).length;
  
  return (
    <div className={`${styles.mediaPoolSidebar} ${!isExpanded ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h3>Media Pool</h3>
          <div className={styles.stats}>
            <span className={styles.assetCount}>{assetCount} assets</span>
            {approvedCount > 0 && (
              <span className={styles.approvedCount}>{approvedCount} approved</span>
            )}
          </div>
        </div>
        <button 
          className={styles.toggleButton} 
          onClick={handleToggle}
          aria-label={isExpanded ? 'Collapse media pool' : 'Expand media pool'}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            {isExpanded ? (
              <path d="M12 8L8 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M8 8L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>
      
      {isExpanded && (
        <>
          <Tabs 
            tabs={[
              { id: 'all', label: 'All' },
              { id: 'images', label: 'Images' },
              { id: 'scripts', label: 'Scripts' },
              { id: 'uploads', label: 'Uploads' },
              { id: 'approved', label: 'Approved' },
            ]}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as TabType)}
          />
          
          <div className={styles.assetGrid}>
            {filteredAssets.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No assets yet</p>
                <span className={styles.emptyHint}>
                  {activeTab === 'approved' 
                    ? 'Approve assets to see them here'
                    : 'Assets will appear as you generate or upload them'
                  }
                </span>
              </div>
            ) : (
              filteredAssets.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isActive={
                    asset.id === mediaPool.activeAvatarId ||
                    asset.id === mediaPool.activeProductId ||
                    asset.id === mediaPool.approvedScriptId
                  }
                  isSelected={selectedAsset === asset.id}
                  onSelect={() => setSelectedAsset(selectedAsset === asset.id ? null : asset.id)}
                  onApprove={() => handleAction('approve', asset.id)}
                  onUse={() => handleAction('use', asset.id)}
                  onRemove={() => handleAction('remove', asset.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface TabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className={styles.tabs}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

interface AssetCardProps {
  asset: MediaAsset;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onUse: () => void;
  onRemove: () => void;
}

function AssetCard({ asset, isActive, isSelected, onSelect, onApprove, onUse, onRemove }: AssetCardProps) {
  const [imageError, setImageError] = useState(false);
  
  const getAssetIcon = () => {
    if (asset.type.includes('script')) {
      return (
        <svg className={styles.assetIcon} width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="8" y="6" width="24" height="28" rx="2" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="12" x2="28" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="18" x2="28" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="24" x2="22" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    }
    
    if (asset.type.includes('video')) {
      return (
        <svg className={styles.assetIcon} width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="6" y="10" width="28" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M16 14L26 20L16 26V14Z" fill="currentColor" />
        </svg>
      );
    }
    
    return (
      <svg className={styles.assetIcon} width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="6" width="28" height="28" rx="2" stroke="currentColor" strokeWidth="2" />
        <circle cx="15" cy="15" r="3" fill="currentColor" />
        <path d="M6 28L14 20L20 26L28 18L34 24V32C34 33.1 33.1 34 32 34H8C6.9 34 6 33.1 6 32V28Z" fill="currentColor" opacity="0.5" />
      </svg>
    );
  };
  
  return (
    <div 
      className={`${styles.assetCard} ${isActive ? styles.activeCard : ''} ${isSelected ? styles.selectedCard : ''}`}
      onClick={onSelect}
    >
      <div className={styles.assetPreview}>
        {asset.url && !imageError ? (
          <img 
            src={asset.url} 
            alt={asset.type}
            onError={() => setImageError(true)}
            className={styles.assetImage}
          />
        ) : (
          getAssetIcon()
        )}
        
        {asset.status === 'generating' && (
          <div className={styles.generatingOverlay}>
            <div className={styles.spinner} />
          </div>
        )}
        
        {asset.status === 'failed' && (
          <div className={styles.failedOverlay}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
          </div>
        )}
      </div>
      
      <div className={styles.assetInfo}>
        <div className={styles.assetHeader}>
          <span className={styles.assetType}>{asset.type}</span>
          <div className={styles.badges}>
            {asset.approved && (
              <span className={styles.approvedBadge} title="Approved">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="currentColor" />
                  <path d="M5 8L7 10L11 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
            {isActive && (
              <span className={styles.activeBadge} title="Active">★</span>
            )}
          </div>
        </div>
        
        {/* Natural description - not structured fields */}
        <p className={styles.description} title={asset.description}>
          {asset.description}
        </p>
        
        {asset.error && (
          <p className={styles.error}>{asset.error}</p>
        )}
      </div>
      
      {isSelected && (
        <div className={styles.assetActions} onClick={(e) => e.stopPropagation()}>
          {!asset.approved && asset.status === 'ready' && (
            <button 
              className={styles.actionButton}
              onClick={onApprove}
              title="Approve this asset"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8L6 11L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Approve
            </button>
          )}
          {asset.status === 'ready' && (
            <button 
              className={styles.actionButton}
              onClick={onUse}
              title="Use this asset"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Use
            </button>
          )}
          <button 
            className={`${styles.actionButton} ${styles.removeButton}`}
            onClick={onRemove}
            title="Remove this asset"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
