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
            background-color: #f5eaed;
        }

        .icon {
            width: 20px;
            height: 20px;
            fill: currentColor;
        }

        .main a {
            color: currentColor;
        }

        .main {
            padding: 32px;
            line-height: 1.5;
            color: #d0dbed;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 400;
            font-family: "Inter", sans-serif;
            background-color: #7b4258;
            margin: 0;
            box-sizing: border-box;
        }

        a {
            color: currentColor;
            word-break: break-all;
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
            margin: 0 auto;
            margin-top: 32px;
        }

        h1 {
            font-size: 22px;
            margin-bottom: 0px;
            margin-top: 0px;
            color: #f0f2fb;
        }

        h2 {
            font-size: 20px;
            font-weight: 600;
            color: #c9cde1;
        }

        h3 {
            font-size: 14px;
            font-weight: 500;
            color: #d2d5e4;
            line-height: 21px;
            margin: 0;
            padding: 0;
        }

        h4 {
            font-family: "DM Sans", sans-serif;
            font-weight: 600;
            font-size: 12px;
            color: #d5dae6;
            margin: 0;
            padding: 0;
        }

        hr {
            border: none;
            border-top: 1px solid #cf91a7;
        }
    </style>
    <style>
        a.button {
            display: inline-block;
            background: #cf91a7;
            color: #ffffff;
            border-radius: 8px;
            height: 48px;
            padding: 12px 20px;
            box-sizing: border-box;
            cursor: pointer;
            text-align: center;
            text-decoration: none;
            border-color: #aa6e7f;
            border-style: solid;
            border-width: 1px;
            margin-right: 24px;
            margin-top: 8px;
        }

        a.button:hover,
        a.button:focus {
            opacity: 0.8;
        }

        @media only screen and (max-width: 600px) {
            .button {
                width: 100%;
            }
        }

        .social-icon {
            border-radius: 999px;
            background: rgba(216, 216, 219, 0.1);
            width: 32px;
            height: 32px;
            line-height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .social-icon>img {
            margin: auto;
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
                    border-top: solid 1px #aa6e7f;
                ">
            <tr>
                <td></td>
            </tr>
        </table>

        <table style="width: auto; margin: 0 auto">
            <tr>
                <td style="padding-left: 4px; padding-right: 4px">
                    <a href="https://twitter.com/nuvix" class="social-icon" title="Twitter">
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="icon">
                            <g>
                                <path
                                    d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z">
                                </path>
                            </g>
                        </svg> </a>
                </td>
                <td style="padding-left: 4px; padding-right: 4px">
                    <a href="https://nuvix.io/discord" class="social-icon">
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
                    <a href="https://github.com/ravikan6/nuvix" class="social-icon">
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
                <td><a href="https://nuvix.io/terms">Terms</a></td>
                <td style="color: #e8e9f0">
                    <div style="margin: 0 8px">|</div>
                </td>
                <td><a href="https://nuvix.io/privacy">Privacy</a></td>
            </tr>
        </table>
        <p style="text-align: center" align="center">
            &copy; {{year}} Nuvix | All rights reserved.
        </p>
    </div>
</body>

</html>