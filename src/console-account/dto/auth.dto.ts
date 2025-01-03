

export class LoginDto {
  email: string;
  password: string;
}

export class RegisterDto {
  email: string;
  password: string;
  name: string;
}

export class RefreshDto {
  refreshToken: string
}