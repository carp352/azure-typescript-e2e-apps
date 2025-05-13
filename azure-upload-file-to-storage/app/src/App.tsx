import { BlockBlobClient } from '@azure/storage-blob';
//import { Box, Button, Card, CardMedia, Grid, Typography } from '@mui/material';
import { Box, Button, Typography } from '@mui/material';
import { ChangeEvent, useState } from 'react';
import ErrorBoundary from './components/error-boundary';
import { convertFileToArrayBuffer } from './lib/convert-file-to-arraybuffer';

import './App.css';

// Used only for local development
// if not defined, then set to empty string so the local server is used.
const API_SERVER = (import.meta.env.VITE_API_SERVER as string) || '';

type SasResponse = {
  url: string;
};
type ListResponse = {
  list: string[];
};

function App() {
  const containerName = `upload`;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  //const [sasTokenUrl, setSasTokenUrl] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  //const [list, setList] = useState<string[]>([]);

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const { target } = event;

    if (!(target instanceof HTMLInputElement)) return;
    if (
      target?.files === null ||
      target?.files?.length === 0 ||
      target?.files[0] === null
    )
      return;

    setSelectedFile(target?.files[0]);

    // reset
    //setSasTokenUrl('');
    setUploadStatus('');
  };

  const handleFileSasToken = async (): Promise<string> => {
    const permission = 'w'; // write
    const timerange = 5; // minutes

    if (!selectedFile) return '';

    const url = `${API_SERVER}/api/sas?file=${encodeURIComponent(
      selectedFile.name
    )}&permission=${permission}&container=${containerName}&timerange=${timerange}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText} - URL: ${url}`);
      }

      const data: SasResponse = await response.json();
      const { url: sasUrl } = data;

      if (!sasUrl || !sasUrl.startsWith('https://')) {
        throw new Error('Invalid SAS token URL received from API');
      }

      //setSasTokenUrl(sasUrl);
      return sasUrl;
    } catch (error: unknown) {
      if (error instanceof Error) {
        const { message, stack } = error;
        return `Error getting sas token: ${message} ${stack || ''}`;
      } else {
        return String(error);
      }
    }
  };

  const handleFileUpload = () => {
    handleFileSasToken()
      .then((sasUrl) => {
      if (!sasUrl || !sasUrl.startsWith('https://')) {
        setUploadStatus('SAS token URL is not available ' + sasUrl);
        return;
      }

      return convertFileToArrayBuffer(selectedFile as File)
        .then((fileArrayBuffer) => {
        if (
          fileArrayBuffer === null ||
          fileArrayBuffer.byteLength < 1 ||
          fileArrayBuffer.byteLength > 256000
        )
          return;

        const blockBlobClient = new BlockBlobClient(sasUrl);
        return blockBlobClient.uploadData(fileArrayBuffer);
        })
        .then(() => {
        setUploadStatus('Successfully finished upload');
        return fetch(`${API_SERVER}/api/list?container=${containerName}`);
        })
        .then((response) => {
        if (!response.ok) {
          throw new Error(`Error: ${response.status} ${response.statusText} - URL: ${response.url}`);
        }
        return response.json();
        })
        .then((data: ListResponse) => {
          //Make sure our file is in the list
        //setList(data.list);
          if (selectedFile && data.list.includes(selectedFile.name)) {
            setUploadStatus('Upload verified: file is present in the container.');
          } else {
            setUploadStatus('Upload finished, but file not found in container list.');
          }
        });
      })
      .catch((error: unknown) => {
      if (error instanceof Error) {
        const { message, stack } = error;
        setUploadStatus(
        `Failed to finish upload with error : ${message} ${stack || ''}`
        );
      } else {
        setUploadStatus(String(error));
      }
      });
  };

  return (
    <>
      <ErrorBoundary>
        <Box m={4}>
          {/* App Title */}
          <Typography variant="h4" gutterBottom>
            Diebold Nixdorf OneTouch File Upload
          </Typography>
          {/* File Selection Section */}
          <Box
            display="block"
            justifyContent="left"
            alignItems="left"
            flexDirection="column"
            my={4}
          >
            <Button variant="contained" component="label">
              Select File
              <input type="file" hidden onChange={handleFileSelection} />
            </Button> {/*TODO: add a fild drag target to the right */}
            {selectedFile && selectedFile.name && (
              <Box my={2}>
                <Typography variant="body2">{selectedFile.name}</Typography>
              </Box>
            )}
          </Box>

          {/* SAS Token Section */}
          {/*selectedFile && selectedFile.name && (
            <Box
              display="block"
              justifyContent="left"
              alignItems="left"
              flexDirection="column"
              my={4}
            >
              <Button variant="contained" onClick={handleFileSasToken}>
                Get SAS Token
              </Button>
              {sasTokenUrl && (
                <Box my={2}>
                  <Typography variant="body2">{sasTokenUrl}</Typography>
                </Box>
              )}
            </Box>
          )*/}

          {/* File Upload Section */}
          {/*sasTokenUrl*/ selectedFile && selectedFile.name && (
            <Box
              display="block"
              justifyContent="left"
              alignItems="left"
              flexDirection="column"
              my={4}
            >
              <Button variant="contained" onClick={handleFileUpload}>
                Upload
              </Button>
              {uploadStatus && (
                <Box my={2}>
                  <Typography variant="body2" gutterBottom>
                    {uploadStatus}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Uploaded Files Display
          /* <Grid container spacing={2}>
            list.map((item) => (
              <Grid item xs={6} sm={4} md={3} key={item}>
                <Card>
                  {item.endsWith('.jpg') ||
                  item.endsWith('.png') ||
                  item.endsWith('.jpeg') ||
                  item.endsWith('.gif') ? (
                    <CardMedia component="img" image={item} alt={item} />
                  ) : (
                    <Typography variant="body1" gutterBottom>
                      {item}
                    </Typography>
                  )}
                </Card>
              </Grid>
            ))}
          </Grid> */
          }
        </Box>
      </ErrorBoundary>
    </>
  );
}

export default App;
