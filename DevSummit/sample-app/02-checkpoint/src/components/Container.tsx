import React, { useState, useEffect, useRef } from 'react';
import {
  AddRegular,
  ArrowUploadRegular,
  FolderRegular,
  DocumentRegular,
  SaveRegular,
  DeleteRegular,
  LockClosedRegular,
  TextBulletListRegular,
  CheckmarkFilled,
  ShareRegular
} from '@fluentui/react-icons';
import {
  Button, Link, Spinner,
  Breadcrumb, BreadcrumbItem, BreadcrumbDivider, BreadcrumbButton,
  DataGrid, DataGridHeader, DataGridHeaderCell, DataGridBody, DataGridRow, DataGridCell,
  TableColumnDefinition, TableRowId, TableCellLayout, createTableColumn,
  SelectionItemId,
  Toolbar, ToolbarButton, ToolbarDivider
} from "@fluentui/react-components";
import { DriveItem } from "@microsoft/microsoft-graph-types-beta";
import { IContainer } from "../common";
import * as MOCKS from "../mock-data";
import {
  DialogContainerProperties,
  DialogContainerPermissions,
  DialogDeleteConfirmation,
  DialogNewFolder,
} from "./dialogs";

import { Providers } from "@microsoft/mgt-element";

interface IContainerProps {
  container: IContainer;
}

interface IDriveItemExtended extends DriveItem {
  isFolder: boolean;
  modifiedByName: string;
  iconElement: JSX.Element;
  downloadUrl: string;
  shareUrl?: string;
}

type BreadcrumbNavItem = string | DriveItem;

export const Container = (props: IContainerProps) => {

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbNavItem[]>([]);
  const [folderId, setFolderId] = useState<string>('root');
  const [driveItems, setDriveItems] = useState<IDriveItemExtended[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<SelectionItemId>>(new Set<TableRowId>([1]));

  const uploadFileRef = useRef<HTMLInputElement>(null);

  const [creatingFolder, setCreatingFolder] = useState<boolean>(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [containerPropsDialogOpen, setContainerPropsDialogOpen] = useState(false);
  const [containerPermissionsDialogOpen, setContainerPermissionsDialogOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setBreadcrumbs(['root']);
      loadItems();
    })();
  }, [props.container]);

  const loadItems = async (itemId?: string) => {
    try {
      const graphClient = Providers.globalProvider.graph.client;
      const driveId = props.container.id;
      const driveItemId = itemId || 'root';

      // get Container items at current folder
      const graphResponse = await graphClient.api(`/drives/${driveId}/items/${driveItemId}/children`)
                                             .get();
      const containerItems: DriveItem[] = graphResponse.value as DriveItem[];

      const items: IDriveItemExtended[] = [];
      containerItems.forEach((driveItem: DriveItem) => {
        items.push({
          ...driveItem,
          isFolder: (driveItem.folder) ? true : false,
          modifiedByName: (driveItem.lastModifiedBy?.user?.displayName)
            ? driveItem.lastModifiedBy!.user!.displayName
            : 'unknown',
          iconElement: (driveItem.folder)
            ? <FolderRegular />
            : <DocumentRegular />,
          downloadUrl: driveItem.webUrl as string
        });
      });
      setDriveItems(items);
    } catch (error: any) {
      console.error(`Failed to load items: ${error.message}`);
    }
  };

  const navigateToFolder = (folder: DriveItem) => {
    // if already in the breadcrumb list, it's higher up the stack, so trim the breadcrumbs
    const index = breadcrumbs.findIndex(b => (typeof b !== 'string') ? b.id === folder.id : false);
    const newBreadcrumbs = (index === -1) ? [...breadcrumbs, folder] : breadcrumbs.slice(0, index + 1);

    setBreadcrumbs(newBreadcrumbs);
    loadItems(folder.id);
    setFolderId(folder.id as string);
  };

  const onCreateFolder = async (folderName: string) => {
    setCreatingFolder(true);

    const currentFolderId = folderId;
    const graphClient = Providers.globalProvider.graph.client;
    const requestBody = {
      "name": folderName,
      "folder": {},
      "@microsoft.graph.conflictBehavior": "rename"
    };
    await graphClient.api(`/drives/${props.container.id}/items/${currentFolderId}/children`)
                     .post(requestBody);

    await loadItems(currentFolderId);

    setNewFolderDialogOpen(false);
    setCreatingFolder(false);
  };

  const onUploadFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files![0];
    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(file);
    fileReader.addEventListener('loadend', async (event: any) => {
      const graphClient = Providers.globalProvider.graph.client;
      const endpoint = `/drives/${props.container.id}/items/${folderId || 'root'}:/${file.name}:/content`;

      graphClient.api(endpoint).putStream(fileReader.result)
        .then(async (response) => {
          await loadItems(folderId || 'root');
        })
        .catch((error) => {
          console.error(`Failed to upload file ${file.name}: ${error.message}`);
        });
    });

    fileReader.addEventListener('error', (event: any) => {
      console.error(`Error on reading file: ${event.message}`);
    });
  };

  const onDeleteItemClick = async () => {
    await new Promise(resolve => setTimeout(resolve, 250));
    await loadItems(folderId || 'root');
    setDeleteDialogOpen(false);
  };

    const onCreateShareLinkClick = async (driveItem: IDriveItemExtended): Promise<void> => {
      if (driveItem.shareUrl === undefined || driveItem.shareUrl === '') {
        driveItem.shareUrl = '';
        setIsCreatingLink(true);
        await new Promise(resolve => setTimeout(resolve, 750));

        setIsCreatingLink(false);
      }
      driveItem.shareUrl = 'https://contoso.com/file.txt';
    }

  const breadcrumbName = (item: string | BreadcrumbNavItem): string => {
    return (typeof item === 'string') ? item : (item as DriveItem).name as string;
  };

  const columns: TableColumnDefinition<IDriveItemExtended>[] = [
    createTableColumn({
      columnId: 'driveItemName',
      renderHeaderCell: () => {
        return 'Name'
      },
      renderCell: (driveItem) => {
        return (
          <TableCellLayout media={driveItem.iconElement}>
            {(!driveItem.isFolder)
              ? <Link href={driveItem!.webUrl!} target='_blank'>{driveItem.name}</Link>
              : <Link onClick={() => { navigateToFolder(driveItem) }}>{driveItem.name}</Link>
            }
          </TableCellLayout>
        )
      }
    }),
    createTableColumn({
      columnId: 'lastModifiedTimestamp',
      renderHeaderCell: () => {
        return 'Last Modified'
      },
      renderCell: (driveItem) => {
        return (
          <TableCellLayout>
            {driveItem.lastModifiedDateTime}
          </TableCellLayout>
        )
      }
    }),
    createTableColumn({
      columnId: 'lastModifiedBy',
      renderHeaderCell: () => {
        return 'Last Modified By'
      },
      renderCell: (driveItem) => {
        return (
          <TableCellLayout>
            {driveItem.modifiedByName}
          </TableCellLayout>
        )
      }
    }),
    createTableColumn({
      columnId: 'actions',
      renderHeaderCell: () => {
        return 'Actions'
      },
      renderCell: (driveItem) => {
        const shareFileLinkIcon = (!driveItem.shareUrl)
          ? <ShareRegular />
          : (isCreatingLink && driveItem.shareUrl === '')
            ? <Spinner size='tiny' />
            : <CheckmarkFilled />;

        return (
          <>
            {!driveItem.isFolder && (<Button aria-label="Share"
              icon={shareFileLinkIcon}
              onClick={() => { onCreateShareLinkClick(driveItem); }}>Share</Button>)}
            <Button aria-label="Delete"
              icon={<DeleteRegular />}
              onClick={() => setDeleteDialogOpen(true)}>Delete</Button>
          </>
        )
      }
    }),

  ];

  const columnSizingOptions = {
    driveItemName: {
      minWidth: 150,
      defaultWidth: 250,
      idealWidth: 200
    },
    lastModifiedTimestamp: {
      minWidth: 150,
      defaultWidth: 150
    },
    lastModifiedBy: {
      minWidth: 150,
      defaultWidth: 150
    },
    actions: {
      minWidth: 250,
      defaultWidth: 250
    }
  };

  return (
    <div>
      <input ref={uploadFileRef} type="file" onChange={onUploadFileSelected} style={{ display: 'none' }} />

      <Toolbar>
        <ToolbarButton
          vertical
          icon={<AddRegular />}
          onClick={() => setNewFolderDialogOpen(true)}>
          New Folder</ToolbarButton>
        <ToolbarButton
          vertical
          icon={<ArrowUploadRegular />}
          onClick={() => { if (uploadFileRef.current) { uploadFileRef.current.click(); } }}>
          Upload File</ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          vertical
          icon={<TextBulletListRegular />}
          onClick={() => setContainerPropsDialogOpen(true)}>
          Properties</ToolbarButton>
        <ToolbarButton
          vertical
          icon={<LockClosedRegular />}
          onClick={() => setContainerPermissionsDialogOpen(true)}>
          Permissions</ToolbarButton>
      </Toolbar>

      <DialogNewFolder
        isOpen={newFolderDialogOpen}
        isCreatingFolder={creatingFolder}
        onCreateFolder={onCreateFolder}
        onClose={() => { setNewFolderDialogOpen(false) }} />

      <DialogDeleteConfirmation
        isOpen={deleteDialogOpen}
        onConfirm={(confirmed) => { (confirmed) ? onDeleteItemClick() : setDeleteDialogOpen(false); }} />

      <DialogContainerProperties
        isOpen={containerPropsDialogOpen}
        containerId={props.container.id}
        onClose={() => { setContainerPropsDialogOpen(false) }} />

      <DialogContainerPermissions
        isOpen={containerPermissionsDialogOpen}
        containerId={props.container.id}
        onClose={() => { setContainerPermissionsDialogOpen(false) }} />

      <Breadcrumb aria-label='Breadcrumb navigation'>
        {
          breadcrumbs.map((item, index) => {
            return (
              <BreadcrumbItem key={index}>
                <BreadcrumbButton
                  onClick={() => {
                    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
                    navigateToFolder(item as DriveItem);
                    setBreadcrumbs(newBreadcrumbs);
                  }
                  }>
                  {breadcrumbName(item)}
                </BreadcrumbButton>
                {(index < breadcrumbs.length - 1) && <BreadcrumbDivider />}
              </BreadcrumbItem>
            )
          })
        }
      </Breadcrumb>

      <DataGrid
        items={driveItems}
        columns={columns}
        getRowId={(item) => item.id}
        resizableColumns
        columnSizingOptions={columnSizingOptions}
        selectionMode='single'
        selectedItems={selectedRows}
        onSelectionChange={(e, d) => { setSelectedRows(d.selectedItems); }}>
        <DataGridHeader>
          <DataGridRow>
            {({ renderHeaderCell }) => (
              <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
            )}
          </DataGridRow>
        </DataGridHeader>
        <DataGridBody<IDriveItemExtended>>
          {({ item, rowId }) => (
            <DataGridRow<IDriveItemExtended> key={rowId}>
              {({ renderCell, columnId }) => (
                <DataGridCell>
                  {renderCell(item)}
                </DataGridCell>
              )}
            </DataGridRow>
          )}
        </DataGridBody>
      </DataGrid>
    </div>
  );
}

export default Container;
