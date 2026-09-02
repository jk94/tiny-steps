import { ArgumentsHost, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { MulterError } from 'multer';
import { MulterExceptionFilter } from './multer-exception.filter';

function mockHost() {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('MulterExceptionFilter', () => {
  const filter = new MulterExceptionFilter();

  it('maps LIMIT_FILE_SIZE to a 400 with a sensible body and PHOTO_TOO_LARGE code', () => {
    const { host, response } = mockHost();
    const exception = new MulterError('LIMIT_FILE_SIZE');

    filter.catch(exception, host);

    const expected = new BadRequestException({
      statusCode: 400,
      code: 'PHOTO_TOO_LARGE',
      message: 'Uploaded file exceeds the maximum allowed size',
    });
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expected.getResponse());
  });

  it('maps LIMIT_UNEXPECTED_FILE to a 400 mentioning the offending field with PHOTO_UPLOAD_ERROR code', () => {
    const { host, response } = mockHost();
    const exception = new MulterError('LIMIT_UNEXPECTED_FILE', 'wrongField');

    filter.catch(exception, host);

    const expected = new BadRequestException({
      statusCode: 400,
      code: 'PHOTO_UPLOAD_ERROR',
      message: 'Unexpected file field "wrongField"',
    });
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expected.getResponse());
  });

  it('maps a PayloadTooLargeException (what FileInterceptor actually throws for LIMIT_FILE_SIZE) to a 400 with PHOTO_TOO_LARGE code', () => {
    // @nestjs/platform-express's FileInterceptor transforms a raw
    // LIMIT_FILE_SIZE MulterError into a PayloadTooLargeException (413)
    // before any @Catch(MulterError) filter would see it — this app wants
    // a uniform 400 for all upload validation failures instead.
    const { host, response } = mockHost();
    const exception = new PayloadTooLargeException();

    filter.catch(exception, host);

    const expected = new BadRequestException({
      statusCode: 400,
      code: 'PHOTO_TOO_LARGE',
      message: 'Uploaded file exceeds the maximum allowed size',
    });
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expected.getResponse());
  });
});
