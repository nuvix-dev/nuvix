<!doctype html>
<html>

<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <style>
        @media (max-width:500px) {
            .mobile-full-width {
                width: 100%;
            }
        }

        body {
            background-color: #ffffff;
            margin: 0;
            padding: 0;
        }

        .icon {
            width: 20px;
            height: 20px;
            fill: currentColor;
        }

        .main a {
            color: #007bff;
        }

        .main {
            padding: 32px;
            line-height: 1.6;
            color: #333333;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 400;
            font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #ffffff;
            margin: 0;
            box-sizing: border-box;
            border: 1px solid #e5e5e5;
        }

        a {
            color: #007bff;
            text-decoration: none;
            word-break: break-word;
        }

        a:hover {
            text-decoration: underline;
        }

        table {
            width: 100%;
            border-spacing: 0 !important;
        }

        table,
        tr,
        th,
        td {
            margin: 0;
            padding: 0;
        }

        td {
            vertical-align: top;
        }

        .main {
            max-width: 650px;
            margin: 32px auto;
        }

        h1 {
            font-size: 24px;
            margin-bottom: 0px;
            margin-top: 0px;
            color: #1a1a1a;
            font-weight: 600;
        }

        h2 {
            font-size: 20px;
            font-weight: 600;
            color: #333333;
        }

        h3 {
            font-size: 16px;
            font-weight: 500;
            color: #555555;
            line-height: 24px;
            margin: 0;
            padding: 0;
        }

        h4 {
            font-family: "Inter", sans-serif;
            font-weight: 600;
            font-size: 14px;
            color: #666666;
            margin: 0;
            padding: 0;
        }

        hr {
            border: none;
            border-top: 1px solid #e5e5e5;
        }
    </style>
    <style>
        a.button {
            display: inline-block;
            background: #007bff;
            color: #ffffff;
            border-radius: 6px;
            height: 48px;
            padding: 12px 24px;
            box-sizing: border-box;
            cursor: pointer;
            text-align: center;
            text-decoration: none;
            border: 1px solid #007bff;
            margin-right: 24px;
            margin-top: 8px;
            font-weight: 500;
        }

        a.button:hover,
        a.button:focus {
            background: #0056b3;
            border-color: #0056b3;
            text-decoration: none;
        }

        @media only screen and (max-width: 600px) {
            .button {
                width: 100%;
            }
        }

        .social-icon {
            border-radius: 6px;
            background: #f8f9fa;
            border: 1px solid #e5e5e5;
            width: 32px;
            height: 32px;
            line-height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }

        .social-icon:hover {
            background: #e9ecef;
            border-color: #dee2e6;
        }

        .social-icon>img {
            margin: auto;
        }

        .social-icon svg {
            fill: #666666;
        }
    </style>
</head>

<body>
    <div class="main">
        <table>
            <tr>
                <td>
                    <img height="32px" src="https://{{img_host}}/public/images/nuvix-logo-dark.svg" />
                </td>
            </tr>
        </table>

        <table style="margin-top: 32px">
            <tr>
                <td>
                    <h1>{{subject}}</h1>
                </td>
            </tr>
        </table>

        <table style="margin-top: 32px">
            <tr>
                <td>
                    {{{body}}}
                </td>
            </tr>
        </table>

        <table style="
                    padding-top: 32px;
                    margin-top: 32px;
                    border-top: solid 1px #e5e5e5;
                ">
            <tr>
                <td></td>
            </tr>
        </table>

        <table style="width: auto; margin: 0 auto">
            <tr>
                <td style="padding-left: 4px; padding-right: 4px">
                    <a href="https://twitter.com/nuvixdev" class="social-icon" title="Twitter">
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="icon">
                            <g>
                                <path
                                    d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z">
                                </path>
                            </g>
                        </svg> </a>
                </td>
                <td style="padding-left: 4px; padding-right: 4px">
                    <a href="https://nuvix.in/discord" class="social-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="icon">
                            <g>
                                <path
                                    d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 14.5c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm-9-3c0 .828-.672 1.5-1.5 1.5S4.5 13.328 4.5 12s.672-1.5 1.5-1.5S7.5 11.172 7.5 12zm8-3c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5S16.5 7.672 16.5 8s-.672 1.5-1.5 1.5z">
                                </path>
                            </g>
                        </svg>
                    </a>
                </td>
                <td style="padding-left: 4px; padding-right: 4px">
                    <a href="https://github.com/Nuvix-Tech/nuvix" class="social-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="icon">
                            <g>
                                <path
                                    d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z">
                                </path>
                            </g>
                        </svg>
                    </a>
                </td>
            </tr>
        </table>
        <table style="width: auto; margin: 0 auto; margin-top: 60px">
            <tr>
                <td><a href="https://nuvix.in/terms">Terms</a></td>
                <td style="color: #999999">
                    <div style="margin: 0 8px">|</div>
                </td>
                <td><a href="https://nuvix.in/privacy">Privacy</a></td>
            </tr>
        </table>
        <p style="text-align: center; color: #666666; font-size: 14px;" align="center">
            &copy; {{year}} Nuvix | All rights reserved.
        </p>
    </div>
</body>

</html>
