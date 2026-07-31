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

  it('maps LIMIT_FILE_SIZE to a 400 with a sensible body', () => {
    const { host, response } = mockHost();
    const exception = new MulterError('LIMIT_FILE_SIZE');

    filter.catch(exception, host);

    const expected = new BadRequestException('Uploaded file exceeds the maximum allowed size');
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expected.getResponse());
  });

  it('maps LIMIT_UNEXPECTED_FILE to a 400 mentioning the offending field', () => {
    const { host, response } = mockHost();
    const exception = new MulterError('LIMIT_UNEXPECTED_FILE', 'wrongField');

    filter.catch(exception, host);

    const expected = new BadRequestException('Unexpected file field "wrongField"');
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expected.getResponse());
  });

  it('maps a PayloadTooLargeException (what FileInterceptor actually throws for LIMIT_FILE_SIZE) to a 400', () => {
    // @nestjs/platform-express's FileInterceptor transforms a raw
    // LIMIT_FILE_SIZE MulterError into a PayloadTooLargeException (413)
    // before any @Catch(MulterError) filter would see it — this app wants
    // a uniform 400 for all upload validation failures instead.
    const { host, response } = mockHost();
    const exception = new PayloadTooLargeException();

    filter.catch(exception, host);

    const expected = new BadRequestException('Uploaded file exceeds the maximum allowed size');
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expected.getResponse());
  });
});
