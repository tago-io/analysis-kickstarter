const htmlBody = `<link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;700&display=swap" rel="stylesheet" />

<head>
    <style>
        *,
        *::after,
        *::before {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        html {
            scroll-behavior: smooth;
            height: 100%;
            width: 100%;
            -webkit-box-sizing: border-box;
            box-sizing: border-box;
            font-size: 62.5%;
            font-family: "Ubuntu", sans-serif;
            margin: 0 auto;
            margin-left: 10px;
        }

        body {
            margin: 0 auto;
            /* padding: 2px; */
            position: relative;
        }

        table {
            border-collapse: collapse;
            margin-top: 40px;
            width: 100%;
            border: 1px solid hsla(0, 0%, 90.2%, 1);
        }

        table caption {
            color: rgba(0, 0, 0, 0.65);
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
        }

        td {
            border-bottom: 1px solid #ddd;
            padding: 10px;
            font-size: 15px;
            /* text-align: center; */
        }

        tr:last-of-type td {
            border: none;
        }

        th {
            color: var(--main-color);
            padding: 10px;
            text-align: left;
        }

        hr {
            border-color: var(--main-color);
            margin-bottom: 30px;
        }

        .container {
            background-color: hsl(0deg 0% 98%);
            margin: auto;
            /* border-radius: 10px; */
        }

        .pdf-header {
            align-items: center;
            padding: 15px 30px;
            /* text-align: center; */
        }

        .header__logo {
            display: inline-block;
            width: 23%;
        }

        .header__logo img {
            width: 100%;
            vertical-align: top;
        }

        .header__info {
            display: inline-block;
            margin-left: 3rem;
            vertical-align: top;
            width: 70%;
            text-align: end;
        }

        .header__info h1 {
            border-radius: 1px;
            display: inline-block;
            margin-top: 1.5rem;
            font-size: 23px;
        }

        .header__info p {
            border-radius: 1px;
        }

        .section__qty {
            padding: 5px 0px;
            display: flex;
            text-align: center;
            margin-top: 3rem;
        }

        .box {
            border: 1px solid hsla(0, 0%, 90.2%, 1);
            padding: 10px;
            display: inline-block;
            height: 120px;
            width: 31%;
            margin: 0 10px;
        }

        .box h1 {
            font-size: 16px;
            width: 200px;
            margin: auto;
        }

        .box h1:last-of-type {
            margin-top: 2rem;
            font-size: 30px;
        }

        .table thead {
            background-color: hsla(0, 0%, 90.2%, 0.6);
            border: 1px solid hsla(0, 0%, 90.2%, 1);
        }

        .center {
            text-align: center;
        }

        .ct-chart {
            height: 100%;
            width: 100%;
            left: 0;
        }

        footer {
            text-align: center;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="section__qty">
            <div class="box">
                <h1 class="ttl__dev">Registered Sensor(s):</h1>
                <h1>$TOTAL_QTY$</h1>
            </div>
            <div class="box">
                <h1 class="active_dev">Active Sensor(s):</h1>
                <h1>$ACTIVE_QTY$</h1>
            </div>
            <div class="box">
                <h1 class="paired_dev">Inactive Sensor(s):</h1>
                <h1>$INACTIVE_QTY$</h1>
            </div>
        </div>
        <table class="table">
            <thead>
                $TABLE_HEADER$
            </thead>
            <tbody>
                $REPORT_TABLE$
            </tbody>
        </table>
    </div>
</body>

</html>`;

export { htmlBody };
